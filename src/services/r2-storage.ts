import { Notice, App, TFile } from 'obsidian';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

import type { WitchSettings } from '../types/settings';
import { resolveFileByPath } from '../utils/file-resolver';
import { getMimeType, isImageExtension } from '../utils/media';

interface ProcessOptions {
	uploadToR2: boolean;
	replaceInOriginal: boolean;
}

export class R2StorageService {
	constructor(private readonly app: App, private readonly settings: WitchSettings) {}

	shouldUseR2(): boolean {
		const s = this.settings;
		return (
			s.enableR2Upload === true &&
			s.r2AccountId.trim() !== '' &&
			s.r2AccessKeyId.trim() !== '' &&
			s.r2SecretAccessKey.trim() !== '' &&
			s.r2BucketName.trim() !== ''
		);
	}

	async processAllImagesInContent(
		content: string,
		currentFile: TFile,
		postTitle: string,
		options: ProcessOptions
	): Promise<{ processedContent: string; uploadedCount: number }> {
		let processedContent = content;
		let uploaded = 0;
		const cache = new Map<string, string>();

		const replaceEmbed = async (fullMatch: string, embedPathRaw: string): Promise<void> => {
			const [pathOrName, altFromEmbed] = embedPathRaw.split('|').map(token => token.trim());

			try {
				const file = await resolveFileByPath(this.app, pathOrName, currentFile);

				if (file && isImageExtension(file.extension ?? '')) {
					let url = cache.get(file.path);
					if (options.uploadToR2 && this.shouldUseR2()) {
						if (!url) {
							const uploadedUrl = await this.uploadToR2(file, postTitle, altFromEmbed);
							if (uploadedUrl) {
								cache.set(file.path, uploadedUrl);
								uploaded++;
							}
							url = uploadedUrl ?? undefined;
						}
					}

					const fallbackAlt = altFromEmbed || file.name;
					const replacementUrl = url || (options.replaceInOriginal ? file.path : pathOrName);
					processedContent = processedContent.replace(fullMatch, `![${fallbackAlt}](${replacementUrl})`);
				}
			} catch (error) {
				console.error(`Failed to process embed ${pathOrName}:`, error);
				processedContent = processedContent.replace(fullMatch, `*[Error processing: ${pathOrName}]*`);
			}
		};

		const embedMatches = Array.from(processedContent.matchAll(/!\[\[([^\]]+?)\]\]/g));
		for (const match of embedMatches) {
			await replaceEmbed(match[0], match[1]);
		}

		const mdMatches = Array.from(processedContent.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
		for (const match of mdMatches) {
			const fullMatch = match[0];
			const alt = match[1].trim();
			let src = match[2].trim();

			if (src.startsWith('<') && src.endsWith('>')) {
				src = src.slice(1, -1).trim();
			}

			if (/^(https?:|data:)/i.test(src)) {
				continue;
			}

			try {
				const file = await resolveFileByPath(this.app, src, currentFile);
				if (file && isImageExtension(file.extension ?? '')) {
					let url = cache.get(file.path);
					if (options.uploadToR2 && this.shouldUseR2()) {
						if (!url) {
							const uploadedUrl = await this.uploadToR2(file, postTitle, alt);
							if (uploadedUrl) {
								cache.set(file.path, uploadedUrl);
								uploaded++;
							}
							url = uploadedUrl ?? undefined;
						}
					}

					if (url) {
						processedContent = processedContent.replace(fullMatch, `![${alt}](${url})`);
					}
				}
			} catch (error) {
				console.error(`Failed to process markdown image ${src}:`, error);
				processedContent = processedContent.replace(fullMatch, `*[Image error: ${alt || src}]*`);
			}
		}

		return { processedContent, uploadedCount: uploaded };
	}

	async uploadToR2(file: TFile, postTitle: string, altText?: string): Promise<string | null> {
		if (!this.shouldUseR2()) {
			return null;
		}

		const extension = (file.extension ?? '').toLowerCase();
		if (!isImageExtension(extension)) {
			console.warn(`Unsupported image format: ${extension}`);
			return null;
		}

		try {
			const binary = await this.app.vault.readBinary(file);
			const buffer = new Uint8Array(binary);

			const fileName = this.buildObjectKey(file, postTitle, extension);
			const client = this.createClient();

			const metadata: Record<string, string> = {};
			if (altText) {
				metadata['caption'] = altText;
			}

			await client.send(new PutObjectCommand({
				Bucket: this.settings.r2BucketName,
				Key: fileName,
				Body: buffer,
				ContentType: getMimeType(extension),
				CacheControl: 'public, max-age=31536000',
				Metadata: metadata
			}));

			return this.buildPublicUrl(fileName);
		} catch (error) {
			console.error('R2 upload failed:', error);
			if (this.settings.debugMode) {
				new Notice(`Failed to upload image to R2: ${error.message}`);
			}
			return null;
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			const client = this.createClient();
			await client.send(new HeadBucketCommand({ Bucket: this.settings.r2BucketName }));
			return true;
		} catch (error) {
			console.error('R2 credentials test failed:', error);
			return false;
		}
	}

	private createClient(): S3Client {
		return new S3Client({
			region: 'auto',
			endpoint: `https://${this.settings.r2AccountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: this.settings.r2AccessKeyId,
				secretAccessKey: this.settings.r2SecretAccessKey
			}
		});
	}

	private generateSlug(str: string): string {
		return str
			.toLowerCase()
			.replace(/\.[^/.]+$/, '')
			.replace(/[^a-z0-9\-_.]/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	private buildObjectKey(file: TFile, title: string, extension: string): string {
		const timestamp = Date.now();
		const randomId = Math.random().toString(36).slice(2, 8);
		const baseName = this.generateSlug(title);
		const originalFileName = this.generateSlug(file.name);
		const fileName = `${baseName}-${originalFileName}-${timestamp}-${randomId}.${extension}`;
		const prefix = this.settings.r2ImagePath.replace(/^\/+/g, '').replace(/\/+/g, '/').replace(/\/+$/g, '');
		return prefix ? `${prefix}/${fileName}` : fileName;
	}

	private buildPublicUrl(objectKey: string): string {
		if (this.settings.r2CustomDomain.trim()) {
			return `https://${this.settings.r2CustomDomain}/${objectKey}`;
		}
		return `https://${this.settings.r2BucketName}.${this.settings.r2AccountId}.r2.dev/${objectKey}`;
	}
}
