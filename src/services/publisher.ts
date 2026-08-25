import { App, Notice, TFile } from 'obsidian';

import type { WitchSettings } from '../types/settings';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import type { ContentApi } from './content-api';
import type { SiteBuilder } from './site-builder';
import type { SiteSettingsService } from './site-settings';
import type { TagManager } from './tag-manager';
import { unpublishKeys } from './site-content';

export class Publisher {
	constructor(
		private readonly app: App,
		private readonly settings: WitchSettings,
		private readonly contentApi: ContentApi,
		private readonly siteBuilder: SiteBuilder,
		private readonly tagManager: TagManager,
		private readonly siteSettings: SiteSettingsService,
		private readonly saveSettings: () => Promise<void>
	) {}

	async publish(file: TFile): Promise<void> {
		await this.reconcileNoteStatus(file);

		const raw = await this.app.vault.read(file);
		const { metadata } = parseFrontmatter(raw);

		if (!metadata.title?.trim()) {
			throw new Error('Note needs a title before publishing');
		}

		const registry = await this.tagManager.ensureTags(metadata.tags ?? []);
		const published = await this.siteBuilder.buildFromFile(file, registry);
		const manifest = await this.contentApi.getManifest();
		const updating = manifest.includes(published.key);

		await this.contentApi.putContent(published.key, published.content);

		// Publishing (or updating) makes the note live: flip a draft to
		// published, unless it is still scheduled for a future date.
		if (metadata.status !== 'scheduled') {
			await this.setNoteStatus(file, 'published');
		}

		this.settings.published[file.path] = new Date().toISOString();
		this.settings.publishedKeys[file.path] = published.key;
		await this.saveSettings();

		new Notice(updating ? `Updated existing post "${published.key}"` : `Published "${published.key}"`);
		await this.cleanupTagArchives();
	}

	private async setNoteStatus(file: TFile, status: 'draft' | 'published' | 'scheduled'): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter.status = status;
		});
	}

	async unpublish(file: TFile): Promise<void> {
		const raw = await this.app.vault.read(file);
		const { metadata } = parseFrontmatter(raw);
		const recordedKey = this.settings.publishedKeys[file.path];
		const candidates = unpublishKeys(metadata, file.basename, this.settings.sectionTags, recordedKey);

		const manifest = await this.contentApi.getManifest();
		const toDelete = candidates.filter(key => manifest.includes(key));
		for (const key of toDelete) {
			await this.contentApi.deleteContent(key);
		}

		// Remove the generated share cards for the note's possible slugs.
		for (const key of candidates) {
			await this.siteBuilder.deleteOgCard(key);
		}

		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter.status = 'draft';
		});
		delete this.settings.published[file.path];
		delete this.settings.publishedKeys[file.path];
		await this.saveSettings();

		new Notice(toDelete.length > 0 ? `Removed "${toDelete.join(', ')}" from the site` : 'Note was not published on the site');
		await this.afterMutation();
	}

	// Tags are metadata (accent colors for cards, chips on posts); they no
	// longer publish archive pages. Remove any legacy tags/*.md archives from
	// the store so stale /tags/... and /<slug>/ pages disappear.
	async cleanupTagArchives(): Promise<void> {
		const manifest = await this.contentApi.getManifest();
		const stale = manifest.filter(key => key.startsWith('tags/') && key.endsWith('.md'));
		for (const key of stale) {
			await this.contentApi.deleteContent(key);
		}
		if (stale.length > 0) {
			new Notice(`Removed ${stale.length} stale tag archive${stale.length === 1 ? '' : 's'}`);
		}
		await this.afterMutation();
	}

	async publishSite(): Promise<void> {
		const site = await this.siteSettings.get();
		await this.contentApi.putContent('site.json', this.siteSettings.serialize(site));
		new Notice('Site settings synced');
		await this.afterMutation();
	}

	async reconcileNoteStatus(file: TFile): Promise<boolean> {
		const raw = await this.app.vault.read(file);
		const { metadata } = parseFrontmatter(raw);
		if (metadata.status !== 'scheduled' || !metadata.published_at) {
			return false;
		}
		const due = new Date(metadata.published_at).getTime();
		if (Number.isNaN(due) || due > Date.now()) {
			return false;
		}
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter.status = 'published';
		});
		return true;
	}

	private async afterMutation(): Promise<void> {
		try {
			await this.contentApi.triggerBuild();
			new Notice('Build triggered');
		} catch (error) {
			new Notice(`Content synced, but the build trigger failed — run sync-content.js to preview locally (${error instanceof Error ? error.message : String(error)})`);
		}
	}
}
