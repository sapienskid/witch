import { App, Notice, TFile } from 'obsidian';

import type { WitchSettings } from '../types/settings';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import type { ContentApi } from './content-api';
import type { SiteBuilder } from './site-builder';
import type { SiteSettingsService } from './site-settings';
import type { TagManager } from './tag-manager';

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

		if (metadata.status === 'draft') {
			new Notice('Draft notes stay local');
			return;
		}
		if (!metadata.title?.trim()) {
			throw new Error('Note needs a title before publishing');
		}

		const registry = await this.tagManager.ensureTags(metadata.tags ?? []);
		const published = await this.siteBuilder.buildFromFile(file, registry);
		const manifest = await this.contentApi.getManifest();
		const updating = manifest.includes(published.key);

		await this.contentApi.putContent(published.key, published.content);

		this.settings.published[file.path] = new Date().toISOString();
		await this.saveSettings();

		new Notice(updating ? `Updated existing post "${published.key}"` : `Published "${published.key}"`);
		await this.cleanupTagArchives();
	}

	async unpublish(file: TFile): Promise<void> {
		const key = await this.siteBuilder.resolveKey(file);
		await this.contentApi.deleteContent(key);

		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter.status = 'draft';
		});
		delete this.settings.published[file.path];
		await this.saveSettings();

		new Notice(`Removed "${key}" from the site and set the note to draft`);
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
