import { App, TFile } from 'obsidian';

import type { ContentMetadata, TagRegistry } from '../types/content';
import type { WitchSettings } from '../types/settings';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import { resolveFileByPath } from '../utils/file-resolver';
import { isImageExtension } from '../utils/media';
import { generateSlug } from '../utils/slug';
import type { MarkdownProcessor } from './markdown-processor';
import { ogCardDataFor } from './og-card';
import { renderOgCard } from './og-image';
import type { R2StorageService } from './r2-storage';
import { buildContent, resolveSection } from './site-content';

export class SiteBuilder {
	constructor(
		private readonly app: App,
		private readonly settings: WitchSettings,
		private readonly markdownProcessor: MarkdownProcessor,
		private readonly r2Service: R2StorageService
	) {}

	async buildFromFile(file: TFile, registry?: TagRegistry) {
		const raw = await this.app.vault.read(file);
		const { metadata, markdownContent } = parseFrontmatter(raw);
		const title = metadata.title || file.basename;
		const body = await this.markdownProcessor.process(markdownContent, file, title);
		const featureImageUrl = await this.resolveFeatureImage(metadata, file, title);
		const ogImageUrl = await this.resolveOgImage(metadata, body, title, registry);
		return buildContent({ metadata, body, title, featureImageUrl, ogImageUrl, registry }, this.settings.sectionTags);
	}

	private async resolveOgImage(metadata: ContentMetadata, body: string, title: string, registry?: TagRegistry): Promise<string | undefined> {
		if (!this.settings.enableOgCards || metadata.og_image?.trim() || !this.r2Service.shouldUseR2()) {
			return undefined;
		}
		try {
			const slug = metadata.slug || generateSlug(title);
			const data = ogCardDataFor({
				siteName: this.settings.site.site?.name ?? '',
				title,
				body,
				excerpt: metadata.excerpt,
				tags: metadata.tags,
				registry,
				section: resolveSection(metadata, this.settings.sectionTags),
				date: metadata.date
			});
			const buffer = await renderOgCard(data);
			return (await this.r2Service.uploadOgImage(slug, buffer)) ?? undefined;
		} catch (error) {
			console.error('OG card generation failed:', error);
			return undefined;
		}
	}

	private async resolveFeatureImage(metadata: ContentMetadata, file: TFile, title: string): Promise<string | undefined> {
		const raw = metadata.feature_image;
		if (!raw) {
			return undefined;
		}
		const trimmed = raw.trim();
		if (/^https?:\/\//.test(trimmed)) {
			return trimmed;
		}

		const embedMatch = trimmed.match(/^!\[\[([^\]]+?)\]\]$/);
		const pathOrName = embedMatch ? String(embedMatch[1]).split('|')[0].trim() : trimmed;
		const imageFile = await resolveFileByPath(this.app, pathOrName, file);
		if (!imageFile || !imageFile.extension || !isImageExtension(imageFile.extension)) {
			return trimmed;
		}
		return (await this.r2Service.uploadToR2(imageFile, title, 'Cover image', 1)) ?? trimmed;
	}
}
