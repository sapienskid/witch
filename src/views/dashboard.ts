import { ItemView, Notice, Setting, TFile, WorkspaceLeaf, debounce } from 'obsidian';

import type WitchPlugin from '../../main';
import type { MediaItem } from '../services/content-api';
import { readSiteNotes, type SiteNote } from '../services/site-notes';
import type { SiteSettings, TagEntry, TagRegistry } from '../types/content';
import type { SiteContentType } from '../types/content';
import { isImageExtension } from '../utils/media';
import { publicMediaUrl } from '../utils/media-url';
import { validateEmail, validateMaxLength, validateUrl } from '../utils/validate';
import { addDropdownField, addTextAreaField, addTextField } from './fields';
import { ImageViewerModal } from './media-viewer';
import { NewNoteModal, NoteSettingsModal, OgPreviewModal, TagEditorModal } from './modals';

export const WITCH_VIEW_TYPE = 'witch-cms';

type TabId = 'posts' | 'pages' | 'tags' | 'site' | 'media';

interface NoteEntry {
	file: TFile;
	metadata: SiteNote['metadata'];
	title: string;
}

const TAB_LABELS: Record<TabId, string> = {
	posts: 'Posts',
	pages: 'Pages',
	tags: 'Tags',
	site: 'Site settings',
	media: 'Media'
};

export class WitchDashboardView extends ItemView {
	private activeTab: TabId = 'posts';
	private noteFilter = { query: '', status: 'all' };
	private selected = new Set<string>();
	private tagRegistry: TagRegistry = {};
	private siteSettings: SiteSettings = {};
	private mediaItems: MediaItem[] = [];
	private mediaFilter = '';
	private selectedMedia = new Set<string>();
	private readonly saveSiteDebounced = debounce(() => void this.saveSite(), 500);

	constructor(leaf: WorkspaceLeaf, private readonly plugin: WitchPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return WITCH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Content dashboard';
	}

	getIcon(): string {
		return 'settings-2';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('view-type-witch-cms');
		const viewWindow = this.containerEl.ownerDocument.defaultView;
		if (viewWindow) {
			this.registerInterval(viewWindow.setInterval(() => void this.reconcile(), 60000));
		}
		await this.render();
	}

	async onClose(): Promise<void> {
		this.saveSiteDebounced.cancel();
		this.contentEl.empty();
	}

	private async render(): Promise<void> {
		const root = this.contentEl;
		root.empty();

		this.statusBar = root.createDiv({ cls: 'witch-status-bar' });
		this.statusBar.createSpan({ text: 'Build status: …' });
		void this.refreshBuildStatus();

		const nav = root.createDiv({ cls: 'witch-tab-nav' });
		(this.tabs() as TabId[]).forEach(tab => {
			const button = nav.createEl('button', { cls: 'witch-tab-button', text: TAB_LABELS[tab] });
			button.toggleClass('active', tab === this.activeTab);
			button.addEventListener('click', () => {
				this.activeTab = tab;
				void this.render();
			});
		});

		this.content = root.createDiv({ cls: 'witch-cms-content' });
		await this.renderActiveTab();
	}

	private async refreshBuildStatus(): Promise<void> {
		const bar = this.statusBar;
		if (!bar) {
			return;
		}
		if (!this.plugin.settings.contentApiUrl.trim()) {
			bar.empty();
			bar.createSpan({ cls: 'witch-build-dot witch-build-error' });
			bar.createSpan({
				text: 'Not configured yet. Deploy witch-worker (pnpm run deploy), set CONTENT_API_TOKEN and BUILD_HOOK_URL secrets, then paste the worker URL + token under Settings → Connection.'
			});
			return;
		}
		try {
			const status = await this.plugin.contentApi.getBuildStatus();
			if (!status || !status.lastBuildAt) {
				bar.setText('No builds yet');
				return;
			}
			bar.empty();
			const ok = status.lastBuildStatus === 'ok';
			bar.createSpan({ cls: `witch-build-dot ${ok ? 'witch-build-ok' : 'witch-build-error'}` });
			const time = new Date(status.lastBuildAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			bar.createSpan({ text: ok ? `Last build: ok · ${time}` : `Last build: failed · ${time}` });
			const siteUrl = this.plugin.settings.site?.site?.url ?? '';
			if (ok && siteUrl) {
				bar.createEl('a', { cls: 'witch-build-link', text: 'Open site', href: siteUrl, attr: { target: '_blank', rel: 'noopener' } });
			}
		} catch {
			bar.setText('Build status unavailable');
		}
	}

	private tabs(): string[] {
		return Object.keys(TAB_LABELS);
	}

	private async renderActiveTab(): Promise<void> {
		switch (this.activeTab) {
			case 'posts':
				await this.renderNotes('post');
				break;
			case 'pages':
				await this.renderNotes('page');
				break;
			case 'tags':
				await this.renderTags();
				break;
			case 'site':
				await this.renderSite();
				break;
			case 'media':
				await this.renderMedia();
				break;
		}
	}

	private async renderNotes(type: string): Promise<void> {
		const container = this.content ?? this.contentEl;
		container.empty();

		const toolbar = container.createDiv({ cls: 'witch-toolbar' });
		const create = toolbar.createEl('button', { cls: 'witch-tab-button active', text: type === 'post' ? 'New post' : 'New page' });
		create.setAttr('aria-label', type === 'post' ? 'Create a new post' : 'Create a new page');
		create.addEventListener('click', () => {
			new NewNoteModal(this.app, this.plugin, type as SiteContentType).open();
		});

		const search = toolbar.createEl('input', { type: 'text', placeholder: 'Search notes', cls: 'witch-search' });
		search.setAttr('aria-label', 'Search notes');
		search.value = this.noteFilter.query;
		search.addEventListener('input', () => {
			this.noteFilter.query = search.value;
			void this.refreshNotesList(container, type);
		});

		const status = toolbar.createEl('select', { cls: 'witch-status-filter' });
		status.setAttr('aria-label', 'Filter by status');
		['all', 'draft', 'published', 'scheduled'].forEach(value => {
			status.createEl('option', { text: value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1), value });
		});
		status.value = this.noteFilter.status;
		status.addEventListener('change', () => {
			this.noteFilter.status = status.value;
			void this.refreshNotesList(container, type);
		});

		const bulk = toolbar.createDiv({ cls: 'witch-toolbar-actions' });
		bulk.createEl('button', { cls: 'witch-tab-button', text: 'Bulk publish' }).addEventListener('click', () => {
			void this.bulkPublish(type);
		});
		bulk.createEl('button', { cls: 'witch-tab-button', text: 'Bulk unpublish' }).addEventListener('click', () => {
			void this.bulkUnpublish(type);
		});
		toolbar.createSpan({ cls: 'witch-toolbar-hint', text: 'Use the toggle on a row to select notes for bulk actions.' });

		const list = container.createDiv({ cls: 'witch-note-list' });
		await this.refreshNotesList(list, type);
	}

	private async refreshNotesList(list: HTMLElement, type: string): Promise<void> {
		list.empty();
		const entries = await this.loadNotes(type);
		const query = this.noteFilter.query.toLowerCase();
		const filtered = entries.filter(entry => {
			if (this.noteFilter.status !== 'all' && entry.metadata.status !== this.noteFilter.status) {
				return false;
			}
			return query.length === 0 || entry.title.toLowerCase().includes(query);
		});

		if (filtered.length === 0) {
			list.createDiv({ cls: 'witch-empty', text: 'No notes found' });
			return;
		}

		for (const entry of filtered) {
			const status = entry.metadata.status ?? 'draft';
			const row = new Setting(list).setName(entry.title).setDesc(this.noteDescription(entry));
			row.settingEl.addClass('witch-note-card');
			row.settingEl.addEventListener('click', event => {
				const target = event.target as HTMLElement;
				if (target.closest('button, input, select, textarea, .checkbox-container')) {
					return;
				}
				void this.openNote(entry);
			});
			row.addToggle(toggle => {
				toggle.setValue(this.selected.has(entry.file.path));
				toggle.toggleEl.setAttr('aria-label', 'Select for bulk actions');
				toggle.toggleEl.setAttr('title', 'Select for bulk actions');
				toggle.onChange(value => {
					if (value) {
						this.selected.add(entry.file.path);
					} else {
						this.selected.delete(entry.file.path);
					}
				});
			});
			row.addButton(button => button.setButtonText('Edit').setTooltip('Edit note settings').onClick(() => void this.editNote(entry)));
			row.addButton(button => button.setButtonText('Card').setTooltip('Preview the share card').onClick(() => new OgPreviewModal(this.app, this.plugin, entry.file).open()));
			row.addButton(button =>
				button
					.setButtonText(status === 'published' ? 'Unpublish' : 'Publish')
					.setTooltip(status === 'published' ? 'Remove from the site' : 'Publish this note')
					.onClick(() => void (status === 'published' ? this.unpublishNote(entry, list, type) : this.publishNote(entry, list, type)))
			);
			row.addButton(button => button.setButtonText('Open').setTooltip('Open the note').onClick(() => void this.openNote(entry)));
		}
	}

	private noteDescription(entry: NoteEntry): DocumentFragment {
		const frag = createFragment();
		const status = entry.metadata.status ?? 'draft';
		const dot = frag.createSpan({ cls: `witch-dot witch-dot-${status}` });
		dot.setAttr('aria-label', `Status: ${status}`);
		dot.setAttr('title', status);
		frag.createSpan({ cls: 'witch-dot-status', text: status });

		if (status === 'published') {
			const publishedAt = this.plugin.settings.published[entry.file.path];
			if (publishedAt) {
				const publishedTime = new Date(publishedAt).getTime();
				frag.createSpan({ cls: 'witch-desc-sep', text: ' · ' });
				frag.createSpan({ text: `last published ${this.formatTime(publishedAt)}` });
				const mtime = entry.file.stat?.mtime ?? 0;
				if (!Number.isNaN(publishedTime) && mtime > publishedTime) {
					frag.createSpan({ cls: 'witch-desc-sep', text: ' · ' });
					frag.createSpan({ cls: 'witch-edited', text: 'edited since publish' });
				}
			}
		} else if (status === 'scheduled' && entry.metadata.published_at) {
			frag.createSpan({ cls: 'witch-desc-sep', text: ' · ' });
			frag.createSpan({ text: `goes live ~${this.formatTime(entry.metadata.published_at)}` });
		}

		frag.createSpan({ cls: 'witch-desc-sep', text: ' · ' });

		const thumbSrc = this.resolveThumbSrc(entry.file, entry.metadata.feature_image ?? '');
		if (thumbSrc) {
			const thumb = frag.createEl('img', { cls: 'witch-thumb', attr: { src: thumbSrc, alt: '' } });
			thumb.setAttr('loading', 'lazy');
			frag.createSpan({ cls: 'witch-desc-sep', text: ' ' });
		}

		const tags = (entry.metadata.tags ?? []).join(', ');
		if (tags) {
			frag.createSpan({ text: tags });
		}
		return frag;
	}

	private formatTime(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	private resolveThumbSrc(file: TFile, featureImage: string): string | null {
		if (!featureImage) {
			return null;
		}
		if (/^https?:\/\//.test(featureImage)) {
			return featureImage;
		}
		const embed = featureImage.match(/^!\[\[([^\]]+?)\]\]$/);
		const link = embed ? String(embed[1]).split('|')[0].trim() : featureImage;

		const dest = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
		if (dest instanceof TFile && dest.extension && isImageExtension(dest.extension)) {
			return this.app.vault.getResourcePath(dest);
		}
		const abs = this.app.vault.getAbstractFileByPath(link);
		if (abs instanceof TFile && abs.extension && isImageExtension(abs.extension)) {
			return this.app.vault.getResourcePath(abs);
		}
		return null;
	}

	private async loadNotes(type: string): Promise<NoteEntry[]> {
		const folderPath = this.plugin.settings.siteFolder || 'Site';
		const notes = await readSiteNotes(this.app, folderPath);
		return notes
			.filter(note => (note.metadata.type ?? 'post') === type)
			.map(note => ({ file: note.file, metadata: note.metadata, title: note.metadata.title || note.file.basename }));
	}

	private async publishNote(entry: NoteEntry, list: HTMLElement, type: string): Promise<void> {
		try {
			await this.plugin.publisher.publish(entry.file);
			void this.refreshBuildStatus();
			await this.refreshNotesList(list, type);
		} catch (error) {
			new Notice(`Publish failed: ${this.errorMessage(error)}`);
		}
	}

	private async unpublishNote(entry: NoteEntry, list: HTMLElement, type: string): Promise<void> {
		try {
			await this.plugin.publisher.unpublish(entry.file);
			void this.refreshBuildStatus();
			await this.refreshNotesList(list, type);
		} catch (error) {
			new Notice(`Unpublish failed: ${this.errorMessage(error)}`);
		}
	}

	private async bulkPublish(type: string): Promise<void> {
		const entries = (await this.loadNotes(type)).filter(entry => this.selected.has(entry.file.path));
		if (entries.length === 0) {
			new Notice('Select notes to publish first');
			return;
		}
		let failed = 0;
		for (const entry of entries) {
			try {
				await this.plugin.publisher.publish(entry.file);
			void this.refreshBuildStatus();
			} catch {
				failed += 1;
			}
		}
		this.selected.clear();
		new Notice(`Published ${entries.length - failed} note${entries.length - failed === 1 ? '' : 's'}`);
		await this.render();
	}

	private async bulkUnpublish(type: string): Promise<void> {
		const entries = (await this.loadNotes(type)).filter(entry => this.selected.has(entry.file.path));
		if (entries.length === 0) {
			new Notice('Select notes to unpublish first');
			return;
		}
		let failed = 0;
		for (const entry of entries) {
			try {
				await this.plugin.publisher.unpublish(entry.file);
			void this.refreshBuildStatus();
			} catch {
				failed += 1;
			}
		}
		this.selected.clear();
		new Notice(`Unpublished ${entries.length - failed} note${entries.length - failed === 1 ? '' : 's'}`);
		await this.render();
	}

	private async editNote(entry: NoteEntry): Promise<void> {
		new NoteSettingsModal(this.app, this.plugin, entry.file).open();
	}

	private async openNote(entry: NoteEntry): Promise<void> {
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(entry.file);
	}

	private async reconcile(): Promise<void> {
		const notes = await readSiteNotes(this.app, this.plugin.settings.siteFolder || 'Site');
		let changed = false;
		for (const note of notes) {
			if (note.metadata.status === 'scheduled' && note.metadata.published_at) {
				const due = new Date(note.metadata.published_at).getTime();
				if (!Number.isNaN(due) && due <= Date.now()) {
					await this.plugin.publisher.reconcileNoteStatus(note.file);
					changed = true;
				}
			}
		}
		if (changed && (this.activeTab === 'posts' || this.activeTab === 'pages')) {
			const container = this.content ?? this.contentEl;
			await this.refreshNotesList(container, this.activeTab);
		}
	}

	private async renderTags(): Promise<void> {
		const container = this.content ?? this.contentEl;
		container.empty();

		this.tagRegistry = await this.plugin.tagManager.getRegistry();
		const tags = Object.values(this.tagRegistry).sort((a, b) => a.name.localeCompare(b.name));

		const toolbar = container.createDiv({ cls: 'witch-toolbar' });
		toolbar.createEl('button', { cls: 'witch-tab-button active', text: 'New tag' }).addEventListener('click', () => {
			new TagEditorModal(this.app, this.plugin, null, () => void this.renderTags()).open();
		});
		toolbar.createEl('button', { cls: 'witch-tab-button', text: 'Clean tag pages' }).addEventListener('click', () => {
			void this.publishTags();
		});
		toolbar.createSpan({ cls: 'witch-toolbar-hint', text: 'Tags are metadata — their accent colors power share cards and they appear as chips on posts. No separate tag pages are published.' });

		const list = container.createDiv({ cls: 'witch-note-list' });
		if (tags.length === 0) {
			list.createDiv({ cls: 'witch-empty', text: 'No tags yet. Use "New tag" to add one.' });
			return;
		}

		for (const entry of tags) {
			const row = new Setting(list).setName(entry.name).setDesc(this.tagDescription(entry));
			row.addButton(button => button.setButtonText('Edit').setTooltip('Edit tag').onClick(() => {
				new TagEditorModal(this.app, this.plugin, entry, () => void this.renderTags()).open();
			}));
			row.addButton(button => button.setButtonText('Delete').setTooltip('Remove tag metadata').onClick(() => void this.deleteTag(entry)));
		}
	}

	private tagDescription(entry: TagEntry): DocumentFragment {
		const frag = createFragment();
		frag.createSpan({ text: entry.slug });
		if (entry.accent_color) {
			const swatch = frag.createSpan({ cls: 'witch-swatch', attr: { style: `background-color: ${entry.accent_color}` } });
			swatch.setAttr('aria-label', `Accent color ${entry.accent_color}`);
		}
		return frag;
	}

	private async deleteTag(entry: TagEntry): Promise<void> {
		await this.plugin.tagManager.deleteTag(entry.slug);
		new Notice(`Removed metadata for "${entry.name}"`);
		await this.renderTags();
	}

	private async publishTags(): Promise<void> {
		try {
			await this.plugin.publisher.cleanupTagArchives();
		} catch (error) {
			new Notice(`Cleanup failed: ${this.errorMessage(error)}`);
		}
	}

	private async renderMedia(): Promise<void> {
		const container = this.content ?? this.contentEl;
		container.empty();

		if (!this.plugin.settings.contentApiUrl.trim()) {
			container.createDiv({ cls: 'witch-empty', text: 'Set the content API URL in settings first' });
			return;
		}

		const toolbar = container.createDiv({ cls: 'witch-toolbar' });
		const uploadButton = toolbar.createEl('button', { cls: 'witch-tab-button active', text: 'Upload image' });
		uploadButton.setAttr('aria-label', 'Upload an image to the media library');
		const fileInput = container.createEl('input', { type: 'file', attr: { accept: 'image/*' } });
		fileInput.hide();
		fileInput.addEventListener('change', () => void this.handleMediaUpload(fileInput, container));
		uploadButton.addEventListener('click', () => fileInput.click());
		const convertButton = toolbar.createEl('button', { cls: 'witch-tab-button', text: 'Convert to WebP' });
		convertButton.setAttr('aria-label', 'Convert all media to WebP');
		convertButton.addEventListener('click', () => {
			void this.plugin.convertMediaToWebP();
		});
		const searchInput = toolbar.createEl('input', { type: 'search', attr: { placeholder: 'Filter media…', 'aria-label': 'Filter media by name' } });
		searchInput.value = this.mediaFilter;
		searchInput.addEventListener('input', () => {
			this.mediaFilter = searchInput.value.trim().toLowerCase();
			this.renderMediaGrid();
		});
		const deleteSelected = toolbar.createEl('button', { cls: 'witch-tab-button', text: 'Delete selected' });
		deleteSelected.setAttr('aria-label', 'Delete the selected media');
		deleteSelected.addEventListener('click', () => void this.deleteSelectedMedia(container));
		toolbar.createSpan({ cls: 'witch-toolbar-hint', text: 'Images upload as optimized WebP; convert any remaining PNG/JPEG media to WebP.' });

		try {
			this.mediaItems = await this.plugin.contentApi.getImages();
		} catch (error) {
			new Notice(`Failed to load media: ${this.errorMessage(error)}`);
			container.createDiv({ cls: 'witch-empty', text: 'Could not load media' });
			return;
		}

		this.selectedMedia = new Set(this.selectedMedia);
		this.renderMediaGrid();
	}

	private renderMediaGrid(): void {
		const container = this.content ?? this.contentEl;
		const existing = container.querySelector('.witch-media-grid');
		existing?.remove();
		const empty = container.querySelector('.witch-empty');
		empty?.remove();

		const filtered = this.mediaItems.filter(item => item.key.toLowerCase().includes(this.mediaFilter));

		if (filtered.length === 0) {
			container.createDiv({ cls: 'witch-empty', text: this.mediaItems.length === 0 ? 'No media yet' : 'No media matches the filter' });
			return;
		}

		const grid = container.createDiv({ cls: 'witch-media-grid' });
		for (const item of filtered) {
			const card = grid.createDiv({ cls: 'witch-media-card witch-media-card-clickable' });
			card.toggleClass('is-selected', this.selectedMedia.has(item.key));
			const url = this.mediaUrl(item.key);
			const img = card.createEl('img', { cls: 'witch-media-thumb', attr: { src: url, alt: item.key, loading: 'lazy' } });
			img.setAttr('referrerpolicy', 'no-referrer');
			card.createDiv({ cls: 'witch-media-name', text: item.key });
			card.createDiv({ cls: 'witch-media-size', text: `${Math.round(item.size / 1024)} KB` });

			const checkbox = card.createEl('input', { type: 'checkbox', attr: { 'aria-label': `Select ${item.key}` } });
			checkbox.checked = this.selectedMedia.has(item.key);
			checkbox.addEventListener('click', event => event.stopPropagation());
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selectedMedia.add(item.key);
				} else {
					this.selectedMedia.delete(item.key);
				}
				card.toggleClass('is-selected', checkbox.checked);
			});

			card.addEventListener('click', () => {
				new ImageViewerModal(this.app, url, item.key).open();
			});
			const actions = card.createDiv({ cls: 'witch-toolbar' });
			actions.createEl('button', { cls: 'witch-tab-button', text: 'Copy URL' }).addEventListener('click', event => {
				event.stopPropagation();
				void this.copyMediaUrl(url);
			});
			actions.createEl('button', { cls: 'witch-tab-button', text: 'Delete' }).addEventListener('click', event => {
				event.stopPropagation();
				void this.deleteMedia(item, container);
			});
		}
	}

	private mediaUrl(key: string): string {
		const prefix = this.plugin.settings.r2ImagePath.replace(/^\/+|\/+$/g, '');
		const fullKey = prefix ? `${prefix}/${key}` : key;
		return publicMediaUrl(this.plugin.settings, fullKey);
	}

	private async handleMediaUpload(input: HTMLInputElement, container: HTMLElement): Promise<void> {
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		if (!this.plugin.r2Service.shouldUseR2()) {
			new Notice('Set up image storage in settings to upload media');
			return;
		}
		try {
			const buffer = new Uint8Array(await file.arrayBuffer());
			const url = await this.plugin.r2Service.uploadMediaFile(buffer, file.name);
			if (url) {
				new Notice('Image uploaded');
			} else {
				new Notice('Upload failed');
			}
			await this.renderMedia();
		} catch (error) {
			new Notice(`Upload failed: ${this.errorMessage(error)}`);
		}
	}

	private async copyMediaUrl(url: string): Promise<void> {
		await navigator.clipboard.writeText(url);
		new Notice('URL copied');
	}

	private async deleteMedia(item: MediaItem, container: HTMLElement): Promise<void> {
		try {
			await this.plugin.contentApi.deleteImage(item.key);
			new Notice(`Deleted ${item.key}`);
			await this.renderMedia();
		} catch (error) {
			new Notice(`Delete failed: ${this.errorMessage(error)}`);
		}
	}

	private async deleteSelectedMedia(container: HTMLElement): Promise<void> {
		if (this.selectedMedia.size === 0) {
			return;
		}
		let deleted = 0;
		for (const key of Array.from(this.selectedMedia)) {
			try {
				await this.plugin.contentApi.deleteImage(key);
				deleted++;
			} catch (error) {
				new Notice(`Delete failed for ${key}: ${this.errorMessage(error)}`);
			}
		}
		this.selectedMedia.clear();
		new Notice(`Deleted ${deleted} item${deleted === 1 ? '' : 's'}`);
		await this.renderMedia();
	}

	private async renderSite(): Promise<void> {
		const container = this.content ?? this.contentEl;
		container.empty();
		this.siteSettings = await this.plugin.siteSettings.get();

		container.createDiv({ cls: 'witch-cms-heading', text: 'Site identity' });
		this.bindText(container, 'Site name', this.siteSettings.site?.name ?? '', { help: 'Name used in the footer and branding.', maxLength: 100 }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, name: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Site title', this.siteSettings.site?.title ?? '', { help: 'Default page title for the site.', maxLength: 200 }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, title: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Tagline', this.siteSettings.site?.tagline ?? '', { help: 'Short line shown under the title.', maxLength: 200 }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, tagline: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Description', this.siteSettings.site?.description ?? '', { help: 'Site description for search engines.', maxLength: 400 }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, description: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Short bio', this.siteSettings.site?.bio_short ?? '', { help: 'One-line bio shown in the footer.', maxLength: 200 }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, bio_short: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Email', this.siteSettings.site?.email ?? '', { help: 'Public contact address.', type: 'email', validate: validateEmail }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, email: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Location', this.siteSettings.site?.location ?? '', { help: 'Shown in the footer.', maxLength: 200 }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, location: value };
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Site URL', this.siteSettings.site?.url ?? '', { help: 'Public base URL, used for the Open site link.', type: 'url', validate: validateUrl }, value => {
			this.siteSettings.site = { ...this.siteSettings.site, url: value };
			this.saveSiteDebounced();
		});

		this.bindAuthoring(container);

		container.createDiv({ cls: 'witch-cms-heading', text: 'Social links' });
		this.bindSocial(container);

		container.createDiv({ cls: 'witch-cms-heading', text: 'Homepage' });
		this.bindHomepage(container);

		container.createDiv({ cls: 'witch-cms-heading', text: 'Search engine' });
		this.bindSeo(container);

		container.createDiv({ cls: 'witch-cms-heading', text: 'Legal' });
		this.bindLegal(container);

		this.bindNav(container);

		container.createDiv({ cls: 'witch-cms-heading', text: 'Code injection' });
		this.bindCodeInjection(container);

		new Setting(container)
			.setName('Publish site settings')
			.setDesc('Changes save to Site/settings.md automatically. Upload and rebuild here.')
			.addButton(button => button.setButtonText('Publish').setTooltip('Upload and build').onClick(() => void this.publishSite()));
	}

	private bindText(container: HTMLElement, label: string, value: string, options: Parameters<typeof addTextField>[3], onChange: (value: string) => void): void {
		addTextField(container, label, value, options, onChange);
	}

	private bindSocial(container: HTMLElement): void {
		const social = this.siteSettings.social ?? {};
		this.siteSettings.social = social;
		for (const network of ['github', 'twitter', 'linkedin']) {
			const entry = social[network] ?? {};
			social[network] = entry;
			addTextField(container, `${network} username`, entry.username ?? '', { help: 'Handle without the leading @.', maxLength: 60 }, value => {
				entry.username = value;
				this.saveSiteDebounced();
			});
			addTextField(container, `${network} URL`, entry.url ?? '', { help: 'Full profile URL.', type: 'url', validate: validateUrl }, value => {
				entry.url = value;
				this.saveSiteDebounced();
			});
		}
	}

	private bindHomepage(container: HTMLElement): void {
		const homepage = this.siteSettings.homepage ?? {};
		this.siteSettings.homepage = homepage;
		this.bindText(container, 'Homepage headline', homepage.heading ?? '', { help: 'Main headline on the homepage; replaces the site title when set.', maxLength: 200 }, value => {
			homepage.heading = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Homepage subtitle', homepage.subtitle ?? '', { help: 'Supporting line under the headline; replaces the site description when set.', maxLength: 300 }, value => {
			homepage.subtitle = value;
			this.saveSiteDebounced();
		});
	}

	private bindSeo(container: HTMLElement): void {
		const seo = this.siteSettings.seo ?? { defaults: {}, content_types: {}, keywords: {} };
		this.siteSettings.seo = seo;
		const defaults = seo.defaults ?? {};
		seo.defaults = defaults;
		const keywords = seo.keywords ?? {};
		seo.keywords = keywords;
		this.bindText(container, 'Meta title suffix', defaults.meta_title_suffix ?? '', { help: 'Appended to page titles, e.g. " | Sabin Pokharel".', maxLength: 100 }, value => {
			defaults.meta_title_suffix = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Meta description fallback', defaults.meta_description_fallback ?? '', { help: 'Used when a page has no description.', maxLength: 400 }, value => {
			defaults.meta_description_fallback = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Default OG image', defaults.og_image_default ?? '', { help: 'Fallback social card image path.', placeholder: '/sabin_avatar.png', maxLength: 300 }, value => {
			defaults.og_image_default = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Twitter card type', defaults.twitter_card_type ?? '', { help: 'e.g. summary_large_image.', placeholder: 'summary_large_image', maxLength: 60 }, value => {
			defaults.twitter_card_type = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Site keywords', keywords.site_keywords ?? '', { help: 'Comma-separated keywords for the whole site.', maxLength: 300 }, value => {
			keywords.site_keywords = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Blog keywords', keywords.blog_keywords ?? '', { help: 'Keywords used on blog pages.', maxLength: 300 }, value => {
			keywords.blog_keywords = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Portfolio keywords', keywords.portfolio_keywords ?? '', { help: 'Keywords used on portfolio pages.', maxLength: 300 }, value => {
			keywords.portfolio_keywords = value;
			this.saveSiteDebounced();
		});
		this.bindText(container, 'Flashcards keywords', keywords.flashcards_keywords ?? '', { help: 'Keywords used on flashcards pages.', maxLength: 300 }, value => {
			keywords.flashcards_keywords = value;
			this.saveSiteDebounced();
		});
	}

	private bindLegal(container: HTMLElement): void {
		const legal = this.siteSettings.legal ?? {};
		this.siteSettings.legal = legal;
		this.bindText(container, 'Copyright holder', legal.copyright_holder ?? '', { help: 'Name in the copyright line.', maxLength: 100 }, value => {
			legal.copyright_holder = value;
			this.saveSiteDebounced();
		});
	}

	private bindNav(container: HTMLElement): void {
		const nav = this.siteSettings.nav ?? { groups: [] };
		this.siteSettings.nav = nav;
		const groups = nav.groups ?? (nav.groups = []);
		container.createDiv({ cls: 'witch-cms-heading', text: 'Navigation' });
		container.createSpan({ cls: 'witch-toolbar-hint', text: 'Add named link groups (main menu, footer, etc.) and add links to each.' });

		const list = container.createDiv({ cls: 'witch-nav-groups' });

		const renderGroups = (): void => {
			list.empty();
			groups.forEach((group, index) => {
				const card = list.createDiv({ cls: 'witch-nav-group' });
				const header = card.createDiv({ cls: 'witch-nav-group-header' });
				const nameInput = header.createEl('input', { type: 'text', placeholder: 'Group name', cls: 'witch-search', value: group.name });
				nameInput.setAttr('aria-label', 'Navigation group name');
				nameInput.addEventListener('input', () => {
					group.name = nameInput.value;
					this.saveSiteDebounced();
				});
				const removeGroup = header.createEl('button', { cls: 'witch-tab-button', text: 'Remove' });
				removeGroup.setAttr('aria-label', `Remove ${group.name || 'this'} nav group`);
				removeGroup.addEventListener('click', () => {
					groups.splice(index, 1);
					this.saveSiteDebounced();
					renderGroups();
				});

				const links = card.createDiv({ cls: 'witch-nav-list' });
				const renderLinks = (): void => {
					links.empty();
					group.links.forEach((item, linkIndex) => {
						const row = new Setting(links);
						row.addText(text => text.setPlaceholder('Label').setValue(item.label).onChange(value => {
							item.label = value;
							this.saveSiteDebounced();
						}));
						row.addText(text => text.setPlaceholder('/about').setValue(item.url).onChange(value => {
							item.url = value;
							this.saveSiteDebounced();
						}));
						row.addButton(button =>
							button
								.setButtonText('Remove')
								.setTooltip('Remove this link')
								.onClick(() => {
									group.links.splice(linkIndex, 1);
									this.saveSiteDebounced();
									renderLinks();
								})
						);
					});
				};
				renderLinks();

				const addLink = card.createEl('button', { cls: 'witch-tab-button', text: 'Add link' });
				addLink.setAttr('aria-label', `Add a link to ${group.name || 'this'} group`);
				addLink.addEventListener('click', () => {
					group.links.push({ label: '', url: '' });
					this.saveSiteDebounced();
					renderLinks();
				});
			});
		};
		renderGroups();

		const addGroup = container.createEl('button', { cls: 'witch-tab-button active', text: 'Add nav group' });
		addGroup.setAttr('aria-label', 'Add a new navigation group');
		addGroup.addEventListener('click', () => {
			groups.push({ name: '', links: [] });
			this.saveSiteDebounced();
			renderGroups();
		});
	}

	private bindAuthoring(container: HTMLElement): void {
		const authoring = this.siteSettings.authoring ?? {};
		this.siteSettings.authoring = authoring;
		container.createDiv({ cls: 'witch-cms-heading', text: 'Authoring defaults' });
		addDropdownField(container, 'Default status', authoring.defaultStatus ?? 'draft', { draft: 'Draft', published: 'Published', scheduled: 'Scheduled' }, value => {
			authoring.defaultStatus = value;
			this.saveSiteDebounced();
		});
		addTextField(container, 'Default author', authoring.defaultAuthor ?? '', { help: 'Used when scaffolding new notes without an author.', maxLength: 100 }, value => {
			authoring.defaultAuthor = value;
			this.saveSiteDebounced();
		});
		addTextField(container, 'Default tags', authoring.defaultTags ?? '', { help: 'Pre-filled tags for new notes.', maxLength: 300 }, value => {
			authoring.defaultTags = value;
			this.saveSiteDebounced();
		});
	}

	private bindCodeInjection(container: HTMLElement): void {
		const codeinjection = this.siteSettings.codeinjection ?? {};
		this.siteSettings.codeinjection = codeinjection;
		addTextAreaField(container, 'Head', codeinjection.head ?? '', { placeholder: 'HTML before </head>' }, value => {
			codeinjection.head = value;
			this.saveSiteDebounced();
		});
		addTextAreaField(container, 'Foot', codeinjection.foot ?? '', { placeholder: 'HTML before </body>' }, value => {
			codeinjection.foot = value;
			this.saveSiteDebounced();
		});
	}

	private async saveSite(): Promise<void> {
		await this.plugin.siteSettings.save(this.siteSettings);
	}

	private validateSiteSettings(): string[] {
		const errors: string[] = [];
		const site = this.siteSettings.site ?? {};

		if (site.email) {
			const error = validateEmail(site.email);
			if (error) {
				errors.push(`Email: ${error}`);
			}
		}
		if (site.title && validateMaxLength(site.title, 200)) {
			errors.push('Site title is too long');
		}
		for (const [label, url] of [
			['GitHub URL', this.siteSettings.social?.github?.url],
			['Twitter URL', this.siteSettings.social?.twitter?.url],
			['LinkedIn URL', this.siteSettings.social?.linkedin?.url],
			['Privacy policy URL', this.siteSettings.legal?.privacy_policy_url],
			['Terms of service URL', this.siteSettings.legal?.terms_of_service_url]
		] as const) {
			if (url) {
				const error = validateUrl(url);
				if (error) {
					errors.push(`${label}: ${error}`);
				}
			}
		}
		return errors;
	}

	private async publishSite(): Promise<void> {
		const errors = this.validateSiteSettings();
		if (errors.length > 0) {
			new Notice(`Fix ${errors.length} setting${errors.length === 1 ? '' : 's'} first: ${errors[0]}`);
			return;
		}
		try {
			await this.plugin.siteSettings.save(this.siteSettings);
			await this.plugin.publisher.publishSite();
			void this.refreshBuildStatus();
		} catch (error) {
			new Notice(`Publish failed: ${this.errorMessage(error)}`);
		}
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private statusBar: HTMLElement | null = null;
	private content: HTMLElement | null = null;
}
