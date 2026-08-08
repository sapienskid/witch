import { App, TFile } from 'obsidian';

import { parseFrontmatter } from '../utils/frontmatter-parser';
import { resolveFileByPath } from '../utils/file-resolver';
import { getMimeType, isImageExtension, isMediaExtension, isPdfExtension, isVideoExtension, youtubeId } from '../utils/media';
import { generateSlug } from '../utils/slug';
import { convertCallouts } from '../utils/callouts';
import { extractBlock, extractSection, parseTransclusionTarget } from '../utils/transclusion';
import type { WitchSettings } from '../types/settings';
import type { R2StorageService } from './r2-storage';
import { computeKey } from './site-content';

export class MarkdownProcessor {
	constructor(
		private readonly app: App,
		private readonly settings: WitchSettings,
		private readonly r2Service: R2StorageService
	) {}

	async process(markdown: string, file: TFile, title: string): Promise<string> {
		let output = markdown;

		const images = await this.r2Service.processAllImagesInContent(output, file, title, {
			uploadToR2: true,
			replaceInOriginal: false,
			asMarkdown: true
		});
		output = images.processedContent;

		output = this.convertYoutubeEmbeds(output);
		output = convertCallouts(output);

		if (this.settings.convertObsidianLinks) {
			output = await this.convertInternalLinks(output, file);
		}

		return output;
	}

	private convertYoutubeEmbeds(markdown: string): string {
		return markdown.replace(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g, (match, url: string) => {
			const id = youtubeId(url);
			return id ? `{{< youtube ${id} >}}` : match;
		});
	}

	private async convertInternalLinks(markdown: string, currentFile: TFile): Promise<string> {
		let output = markdown;

		// Embeds (![[...]]) are inlined; process in reverse so positions stay valid.
		const embeds = Array.from(output.matchAll(/!\[\[([^\]]+?)\]\]/g));
		for (let index = embeds.length - 1; index >= 0; index--) {
			const match = embeds[index];
			const replacement = await this.renderEmbed(match[1], currentFile);
			if (replacement !== undefined && match.index !== undefined) {
				output = output.slice(0, match.index) + replacement + output.slice(match.index + match[0].length);
			}
		}

		// Links ([[...]]) are converted to site paths using the target's real slug.
		const links = Array.from(output.matchAll(/\[\[([^\]]+?)\]\]/g));
		for (let index = links.length - 1; index >= 0; index--) {
			const match = links[index];
			const replacement = await this.renderLink(match[1], currentFile);
			if (replacement !== undefined && match.index !== undefined) {
				output = output.slice(0, match.index) + replacement + output.slice(match.index + match[0].length);
			}
		}

		return output;
	}

	private async renderEmbed(raw: string, currentFile: TFile): Promise<string | undefined> {
		const { path, fragment } = parseTransclusionTarget(raw);
		if (!path) {
			return undefined;
		}
		const file = await resolveFileByPath(this.app, path, currentFile);
		if (!file) {
			return undefined;
		}
		const extension = (file.extension ?? '').toLowerCase();
		if (isImageExtension(extension)) {
			return undefined;
		}
		if (isMediaExtension(extension)) {
			return this.renderMediaEmbed(file, extension);
		}
		if (fragment !== undefined) {
			const { markdownContent } = parseFrontmatter(await this.app.vault.read(file));
			const section = fragment.startsWith('^') ? extractBlock(markdownContent, fragment.slice(1)) : extractSection(markdownContent, fragment.slice(1));
			return section !== undefined ? `\n\n${section}\n\n` : undefined;
		}
		const { markdownContent } = parseFrontmatter(await this.app.vault.read(file));
		return `\n\n${markdownContent}\n\n`;
	}

	private async renderLink(raw: string, currentFile: TFile): Promise<string | undefined> {
		const { path, fragment, display } = parseTransclusionTarget(raw);
		if (!path) {
			return undefined;
		}
		const file = await resolveFileByPath(this.app, path, currentFile);
		const label = display?.trim() || path;
		const urlPath = file ? await this.publishedPathFor(file) : `/${generateSlug(path)}/`;
		const anchor = fragment?.startsWith('#') ? `#${generateSlug(fragment.slice(1))}` : '';
		return `[${label}](${urlPath}${anchor})`;
	}

	private async publishedPathFor(file: TFile): Promise<string> {
		const { metadata } = parseFrontmatter(await this.app.vault.read(file));
		const title = metadata.title || file.basename;
		const key = computeKey(metadata, title, this.settings.sectionTags);
		const base = key.replace(/\.md$/, '').replace(/_index$/, '');
		return `/${base}/`;
	}

	private async renderMediaEmbed(file: TFile, extension: string): Promise<string | undefined> {
		if (!this.r2Service.shouldUseR2()) {
			return undefined;
		}
		try {
			const binary = await this.app.vault.readBinary(file);
			const url = await this.r2Service.uploadMedia(new Uint8Array(binary), file.name, getMimeType(extension));
			if (!url) {
				return undefined;
			}
			if (isPdfExtension(extension)) {
				return `[Download PDF: ${file.basename}](${url})`;
			}
			if (isVideoExtension(extension)) {
				return `<video controls preload="metadata" src="${url}"></video>`;
			}
			return `<audio controls preload="metadata" src="${url}"></audio>`;
		} catch (error) {
			console.error('Media embed failed:', error);
			return undefined;
		}
	}
}
