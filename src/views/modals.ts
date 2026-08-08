import { App, Modal, Notice, Setting, TFile, TFolder, normalizePath } from 'obsidian';

import type WitchPlugin from '../../main';
import type { SiteContentType, TagEntry } from '../types/content';
import { noteFileName, noteScaffold } from '../services/note-factory';
import { ogCardDataFor } from '../services/og-card';
import { renderOgCard } from '../services/og-image';
import { resolveSection } from '../services/site-content';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import { generateSlug, splitTags } from '../utils/slug';
import { validateColor, validateSlug, validateUrl } from '../utils/validate';
import { addDropdownField, addTextField, addTextAreaField, addToggleField } from './fields';
import { TagSuggest, createTagSelector, existingTagNames } from './tag-selector';

export class NewNoteModal extends Modal {
	private title = '';
	private type: SiteContentType;
	private status = 'draft';
	private tags: string[] = [];
	private author = '';

	constructor(app: App, private readonly plugin: WitchPlugin, presetType: SiteContentType) {
		super(app);
		this.type = presetType;
	}

	async onOpen(): Promise<void> {
		this.titleEl.setText(`New ${this.type}`);
		this.modalEl.addClass('witch-modal');

		const site = await this.plugin.siteSettings.get();
		this.status = site.authoring?.defaultStatus ?? 'draft';
		this.tags = splitTags(site.authoring?.defaultTags ?? '');
		this.author = site.authoring?.defaultAuthor ?? '';

		const { contentEl } = this;
		contentEl.empty();

		addTextField(contentEl, 'Title', this.title, { help: 'Shown on the site and in search results.', maxLength: 200, validate: value => (value.trim().length === 0 ? 'A title is required' : null) }, value => {
			this.title = value;
		});
		addDropdownField(contentEl, 'Type', this.type, { post: 'Post', page: 'Page' }, value => {
			this.type = value as SiteContentType;
		});
		addDropdownField(contentEl, 'Status', this.status, { draft: 'Draft', published: 'Published', scheduled: 'Scheduled' }, value => {
			this.status = value;
		});
		new Setting(contentEl).setName('Tags').setDesc('Choose from the tags already used in your vault.');
		createTagSelector(contentEl, this.app, {
			tags: this.tags,
			availableTags: () => existingTagNames(this.app),
			onChange: tags => {
				this.tags = tags;
			}
		});

		const footer = contentEl.createDiv({ cls: 'witch-modal-footer' });
		footer.createEl('button', { cls: 'mod-cta', text: 'Create' }).addEventListener('click', () => void this.create());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async create(): Promise<void> {
		if (!this.title.trim()) {
			new Notice('A title is required');
			return;
		}
		const scaffold = {
			title: this.title.trim(),
			type: this.type,
			status: this.status as 'draft' | 'published' | 'scheduled',
			tags: this.tags,
			author: this.author
		};

		const folder = this.plugin.settings.siteFolder || 'Site';
		await this.ensureFolder(folder);
		const path = await this.uniquePath(folder, noteFileName(scaffold));
		await this.app.vault.create(path, noteScaffold(scaffold));

		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(file);
		}
		new Notice(`Created ${path}`);
		this.close();
	}

	private async uniquePath(folder: string, base: string): Promise<string> {
		let name = base;
		let index = 2;
		while (this.app.vault.getAbstractFileByPath(`${folder}/${name}`) instanceof TFile) {
			name = `${base.replace(/\.md$/, '')}-${index}.md`;
			index += 1;
		}
		return `${folder}/${name}`;
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const normalized = normalizePath(folderPath);
		if (!normalized) {
			return;
		}
		const existing = this.app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFolder) {
			return;
		}
		await this.ensureFolder(normalized.split('/').slice(0, -1).join('/'));
		await this.app.vault.createFolder(normalized);
	}
}

export class NoteSettingsModal extends Modal {
	private title = '';
	private status = 'draft';
	private slug = '';
	private date = '';
	private published_at = '';
	private featured = false;
	private tags: string[] = [];
	private excerpt = '';
	private author = '';
	private feature_image = '';
	private feature_image_alt = '';
	private meta_title = '';
	private meta_description = '';
	private canonical_url = '';
	private keywordsText = '';
	private og_title = '';
	private og_description = '';
	private og_image = '';
	private twitter_title = '';
	private twitter_description = '';
	private twitter_image = '';
	private codeinjection_head = '';
	private codeinjection_foot = '';
	private previewEl: HTMLElement | null = null;

	constructor(app: App, private readonly plugin: WitchPlugin, private readonly file: TFile) {
		super(app);
	}

	async onOpen(): Promise<void> {
		this.titleEl.setText(`Settings · ${this.file.basename}`);
		this.modalEl.addClass('witch-modal');
		this.contentEl.addClass('witch-modal-scroll');

		const raw = await this.app.vault.read(this.file);
		const { metadata } = parseFrontmatter(raw);
		const site = await this.plugin.siteSettings.get();
		const defaultAuthor = site.authoring?.defaultAuthor ?? '';

		this.title = metadata.title ?? this.file.basename;
		this.status = metadata.status ?? 'draft';
		this.slug = metadata.slug ?? '';
		this.date = metadata.date ?? '';
		this.published_at = metadata.published_at ?? '';
		this.featured = metadata.featured ?? false;
		this.tags = metadata.tags ?? [];
		this.excerpt = metadata.excerpt ?? '';
		this.author = metadata.author ?? defaultAuthor;
		this.feature_image = metadata.feature_image ?? '';
		this.feature_image_alt = metadata.feature_image_alt ?? '';
		this.meta_title = metadata.meta_title ?? '';
		this.meta_description = metadata.meta_description ?? '';
		this.canonical_url = metadata.canonical_url ?? '';
		this.keywordsText = (metadata.keywords ?? []).join(', ');
		this.og_title = metadata.og_title ?? '';
		this.og_description = metadata.og_description ?? '';
		this.og_image = metadata.og_image ?? '';
		this.twitter_title = metadata.twitter_title ?? '';
		this.twitter_description = metadata.twitter_description ?? '';
		this.twitter_image = metadata.twitter_image ?? '';
		this.codeinjection_head = metadata.codeinjection_head ?? '';
		this.codeinjection_foot = metadata.codeinjection_foot ?? '';

		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName('General').setHeading();
		addTextField(contentEl, 'Title', this.title, { help: 'Shown on the site and in search results.', maxLength: 200, validate: value => (value.trim().length === 0 ? 'A title is required' : null) }, value => {
			this.title = value;
		});
		addDropdownField(contentEl, 'Status', this.status, { draft: 'Draft', published: 'Published', scheduled: 'Scheduled' }, value => {
			this.status = value;
		});
		addTextField(contentEl, 'Slug', this.slug, { help: 'URL segment; defaults to the title.', placeholder: 'auto-from-title', validate: validateSlug }, value => {
			this.slug = value;
		});
		addTextField(contentEl, 'Date', this.date, { help: 'Publish date used for sorting.', placeholder: 'YYYY-MM-DD' }, value => {
			this.date = value;
		});
		addTextField(contentEl, 'Published at', this.published_at, { help: 'A future date schedules the post; empty publishes immediately.', placeholder: '2026-08-07T10:00:00+05:45' }, value => {
			this.published_at = value;
		});
		addToggleField(contentEl, 'Featured', this.featured, 'Highlights this post on the site.', value => {
			this.featured = value;
		});
		new Setting(contentEl).setName('Tags').setDesc('Choose from the tags already used in your vault.');
		createTagSelector(contentEl, this.app, {
			tags: this.tags,
			availableTags: () => existingTagNames(this.app),
			onChange: tags => {
				this.tags = tags;
			}
		});
		addTextField(contentEl, 'Excerpt', this.excerpt, { help: 'Short summary shown in listings and feeds.', maxLength: 300 }, value => {
			this.excerpt = value;
		});
		addTextField(contentEl, 'Author', this.author, { help: 'Name shown as the byline.', maxLength: 100 }, value => {
			this.author = value;
		});

		new Setting(contentEl).setName('Media').setHeading();
		addTextField(contentEl, 'Feature image', this.feature_image, { help: 'An Obsidian embed (![[cover.png]]) or a public image URL.', placeholder: '![[cover.png]] or https://…', validate: value => (value && !value.startsWith('![') ? validateUrl(value) : null) }, value => {
			this.feature_image = value;
		});
		addTextField(contentEl, 'Feature image alt', this.feature_image_alt, { help: 'Describes the image for accessibility and SEO.', maxLength: 200 }, value => {
			this.feature_image_alt = value;
		});

		new Setting(contentEl).setName('Search engine').setHeading();
		addTextField(contentEl, 'Meta title', this.meta_title, { help: 'Overrides the title in search results.', maxLength: 200 }, value => {
			this.meta_title = value;
		});
		addTextField(contentEl, 'Meta description', this.meta_description, { help: 'Snippet shown under the result in search engines.', maxLength: 400 }, value => {
			this.meta_description = value;
		});
		addTextField(contentEl, 'Canonical URL', this.canonical_url, { help: 'The preferred URL for this content, to avoid duplicates.', type: 'url', validate: validateUrl }, value => {
			this.canonical_url = value;
		});
		addTextField(contentEl, 'Keywords', this.keywordsText, { help: 'Comma-separated topic keywords.', placeholder: 'ai, obsidian', maxLength: 300 }, value => {
			this.keywordsText = value;
		});

		new Setting(contentEl).setName('Social sharing').setHeading();
		addTextField(contentEl, 'OG title', this.og_title, { help: 'Title used when the post is shared on social platforms.', maxLength: 200 }, value => {
			this.og_title = value;
		});
		addTextField(contentEl, 'OG description', this.og_description, { help: 'Description used for social sharing cards.', maxLength: 400 }, value => {
			this.og_description = value;
		});
		addTextField(contentEl, 'OG image', this.og_image, { help: 'Preview image for social sharing cards.', type: 'url', validate: validateUrl }, value => {
			this.og_image = value;
		});
		addTextField(contentEl, 'Twitter title', this.twitter_title, { help: 'Title used when the post is shared on X (Twitter).', maxLength: 200 }, value => {
			this.twitter_title = value;
		});
		addTextField(contentEl, 'Twitter description', this.twitter_description, { help: 'Description used for X (Twitter) cards.', maxLength: 400 }, value => {
			this.twitter_description = value;
		});
		addTextField(contentEl, 'Twitter image', this.twitter_image, { help: 'Preview image for X (Twitter) cards.', type: 'url', validate: validateUrl }, value => {
			this.twitter_image = value;
		});
		new Setting(contentEl)
			.setName('Card preview')
			.setDesc('The share card is generated automatically on publish; preview the current title, excerpt, and colors here.')
			.addButton(button => button.setButtonText('Preview card').setTooltip('Render the share card').onClick(() => void this.renderOgPreview()));
		this.previewEl = contentEl.createDiv({ cls: 'witch-og-preview' });
		this.previewEl.hide();

		new Setting(contentEl).setName('Advanced').setHeading();
		addTextAreaField(contentEl, 'Code injection (head)', this.codeinjection_head, { help: 'HTML injected before </head>.', placeholder: '<meta name="robots" content="index">' }, value => {
			this.codeinjection_head = value;
		});
		addTextAreaField(contentEl, 'Code injection (foot)', this.codeinjection_foot, { help: 'HTML injected before </body>.', placeholder: '<script>console.log("ready")</script>' }, value => {
			this.codeinjection_foot = value;
		});

		const footer = contentEl.createDiv({ cls: 'witch-modal-footer' });
		footer.createEl('button', { cls: 'mod-cta', text: 'Save' }).addEventListener('click', () => void this.save());
	}

	private async renderOgPreview(): Promise<void> {
		try {
			const registry = await this.plugin.tagManager.getRegistry();
			const section = resolveSection({ tags: this.tags }, this.plugin.settings.sectionTags);
			const data = ogCardDataFor({
				siteName: this.plugin.settings.site.site?.name ?? '',
				title: this.title.trim() || this.file.basename,
				body: this.excerpt,
				excerpt: this.og_description || this.excerpt || undefined,
				tags: this.tags,
				registry,
				section,
				date: this.date
			});
			const buffer = await renderOgCard(data);
			const blob = new Blob([buffer as BlobPart], { type: 'image/webp' });
			const url = URL.createObjectURL(blob);
			if (this.previewEl) {
				this.previewEl.empty();
				this.previewEl.createEl('img', { attr: { src: url, alt: 'Share card preview' } });
				this.previewEl.show();
			}
		} catch (error) {
			new Notice(`Could not render the card preview: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async save(): Promise<void> {
		if (!this.title.trim()) {
			new Notice('A title is required');
			return;
		}
		await this.app.fileManager.processFrontMatter(this.file, (frontmatter: Record<string, unknown>) => {
			frontmatter.title = this.title.trim();
			frontmatter.status = this.status;
			if (this.slug.trim()) frontmatter.slug = this.slug.trim();
			else delete frontmatter.slug;
			if (this.date.trim()) frontmatter.date = this.date.trim();
			else delete frontmatter.date;
			if (this.published_at.trim()) frontmatter.published_at = this.published_at.trim();
			else delete frontmatter.published_at;
			frontmatter.featured = this.featured;
			if (this.tags.length > 0) frontmatter.tags = this.tags;
			else delete frontmatter.tags;
			setOrDelete(frontmatter, 'excerpt', this.excerpt);
			setOrDelete(frontmatter, 'author', this.author);
			setOrDelete(frontmatter, 'feature_image', this.feature_image);
			setOrDelete(frontmatter, 'feature_image_alt', this.feature_image_alt);
			setOrDelete(frontmatter, 'meta_title', this.meta_title);
			setOrDelete(frontmatter, 'meta_description', this.meta_description);
			setOrDelete(frontmatter, 'canonical_url', this.canonical_url);
			const keywords = splitTags(this.keywordsText);
			if (keywords.length > 0) frontmatter.keywords = keywords;
			else delete frontmatter.keywords;
			setOrDelete(frontmatter, 'og_title', this.og_title);
			setOrDelete(frontmatter, 'og_description', this.og_description);
			setOrDelete(frontmatter, 'og_image', this.og_image);
			setOrDelete(frontmatter, 'twitter_title', this.twitter_title);
			setOrDelete(frontmatter, 'twitter_description', this.twitter_description);
			setOrDelete(frontmatter, 'twitter_image', this.twitter_image);
			setOrDelete(frontmatter, 'codeinjection_head', this.codeinjection_head);
			setOrDelete(frontmatter, 'codeinjection_foot', this.codeinjection_foot);
		});
		new Notice('Note settings saved');
		this.close();
	}
}

function setOrDelete(frontmatter: Record<string, unknown>, key: string, value: string): void {
	if (value.trim()) {
		frontmatter[key] = value.trim();
	} else {
		delete frontmatter[key];
	}
}

export class TagEditorModal extends Modal {
	private entry: TagEntry;
	private readonly isNew: boolean;

	constructor(
		app: App,
		private readonly plugin: WitchPlugin,
		existing: TagEntry | null,
		private readonly onSaved: (entry: TagEntry) => void
	) {
		super(app);
		this.isNew = existing === null;
		this.entry = existing
			? { ...existing }
			: { name: '', slug: '', visibility: 'public' };
	}

	onOpen(): void {
		this.titleEl.setText(this.entry.slug ? `Tag · ${this.entry.name}` : 'New tag');
		this.modalEl.addClass('witch-modal');
		this.contentEl.addClass('witch-modal-scroll');
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName('General').setHeading();
		if (this.isNew) {
			this.renderNewTagPicker(contentEl);
		} else {
			addTextField(contentEl, 'Name', this.entry.name, { help: 'Display name for the tag.', maxLength: 100, validate: value => (value.trim().length === 0 ? 'A name is required' : null) }, value => {
				this.entry.name = value;
			});
		}
		addTextField(contentEl, 'Slug', this.entry.slug, { help: 'URL segment; defaults to the name.', placeholder: 'auto-from-name', validate: validateSlug }, value => {
			this.entry.slug = value;
		});
		addTextField(contentEl, 'Description', this.entry.description ?? '', { help: 'Shown on the tag archive page.', maxLength: 300 }, value => {
			this.entry.description = value;
		});
		addTextField(contentEl, 'Accent color', this.entry.accent_color ?? '', { help: 'Brand color used by the theme (hex).', maxLength: 9, validate: validateColor }, value => {
			this.entry.accent_color = value;
		});
		addTextField(contentEl, 'Feature image', this.entry.feature_image ?? '', { help: 'Hero image for the tag archive page.', placeholder: 'https://…', validate: validateUrl }, value => {
			this.entry.feature_image = value;
		});
		addDropdownField(contentEl, 'Visibility', this.entry.visibility ?? 'public', { public: 'Public', internal: 'Internal' }, value => {
			this.entry.visibility = value as 'public' | 'internal';
		});

		new Setting(contentEl).setName('Search engine').setHeading();
		addTextField(contentEl, 'Meta title', this.entry.meta_title ?? '', { help: 'Overrides the title in search results.', maxLength: 200 }, value => {
			this.entry.meta_title = value;
		});
		addTextField(contentEl, 'Meta description', this.entry.meta_description ?? '', { help: 'Snippet shown in search results.', maxLength: 400 }, value => {
			this.entry.meta_description = value;
		});
		addTextField(contentEl, 'Canonical URL', this.entry.canonical_url ?? '', { help: 'The preferred URL for the tag archive.', type: 'url', validate: validateUrl }, value => {
			this.entry.canonical_url = value;
		});

		new Setting(contentEl).setName('Social sharing').setHeading();
		addTextField(contentEl, 'OG title', this.entry.og_title ?? '', { help: 'Title used when the tag page is shared.', maxLength: 200 }, value => {
			this.entry.og_title = value;
		});
		addTextField(contentEl, 'OG description', this.entry.og_description ?? '', { help: 'Description used for social sharing cards.', maxLength: 400 }, value => {
			this.entry.og_description = value;
		});
		addTextField(contentEl, 'OG image', this.entry.og_image ?? '', { help: 'Preview image for social sharing cards.', type: 'url', validate: validateUrl }, value => {
			this.entry.og_image = value;
		});
		addTextField(contentEl, 'Twitter title', this.entry.twitter_title ?? '', { help: 'Title used when the tag page is shared on X (Twitter).', maxLength: 200 }, value => {
			this.entry.twitter_title = value;
		});
		addTextField(contentEl, 'Twitter description', this.entry.twitter_description ?? '', { help: 'Description used for X (Twitter) cards.', maxLength: 400 }, value => {
			this.entry.twitter_description = value;
		});
		addTextField(contentEl, 'Twitter image', this.entry.twitter_image ?? '', { help: 'Preview image for X (Twitter) cards.', type: 'url', validate: validateUrl }, value => {
			this.entry.twitter_image = value;
		});

		const footer = contentEl.createDiv({ cls: 'witch-modal-footer' });
		footer.createEl('button', { cls: 'mod-cta', text: 'Save tag' }).addEventListener('click', () => void this.save());
	}

	private renderNewTagPicker(container: HTMLElement): void {
		const setting = new Setting(container).setName('Tag').setDesc('Choose a tag that already exists in Obsidian. You add metadata, not a new tag.');
		let inputEl: HTMLInputElement | undefined;
		setting.addText(text => {
			inputEl = text.inputEl;
			text.setPlaceholder('Start typing to list existing tags…');
			text.setValue(this.entry.name);
		});
		if (!inputEl) {
			return;
		}
		const suggest = new TagSuggest(this.app, inputEl, () => existingTagNames(this.app));
		suggest.onSelect(value => {
			this.entry.name = value;
			this.entry.slug = generateSlug(value);
			this.render();
		});
		inputEl.addEventListener('focus', () => suggest.open());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async save(): Promise<void> {
		if (!this.entry.name.trim()) {
			new Notice('Choose a tag that already exists in Obsidian');
			return;
		}
		if (this.isNew) {
			const matches = existingTagNames(this.app).some(name => name.toLowerCase() === this.entry.name.trim().toLowerCase());
			if (!matches) {
				new Notice('Choose a tag that already exists in Obsidian');
				return;
			}
		}
		const slug = this.entry.slug.trim() || generateSlug(this.entry.name);
		if (!slug) {
			new Notice('Could not create a slug');
			return;
		}
		this.entry.slug = slug;
		this.entry.name = this.entry.name.trim();
		await this.plugin.tagManager.saveEntry(this.entry);
		new Notice(`Tag "${this.entry.name}" saved`);
		this.onSaved(this.entry);
		this.close();
	}
}

export class OgPreviewModal extends Modal {
	constructor(app: App, private readonly plugin: WitchPlugin, private readonly file: TFile) {
		super(app);
	}

	async onOpen(): Promise<void> {
		this.titleEl.setText(`Share card · ${this.file.basename}`);
		this.modalEl.addClass('witch-modal');
		const container = this.contentEl;
		container.empty();

		const raw = await this.app.vault.read(this.file);
		const { metadata } = parseFrontmatter(raw);
		const site = this.plugin.settings;
		const registry = await this.plugin.tagManager.getRegistry();
		const data = ogCardDataFor({
			siteName: site.site.site?.name ?? '',
			title: metadata.title || this.file.basename,
			body: metadata.excerpt ?? '',
			excerpt: metadata.og_description || metadata.excerpt || undefined,
			tags: metadata.tags,
			registry,
			section: resolveSection(metadata, site.sectionTags),
			date: metadata.date
		});

		try {
			const buffer = await renderOgCard(data);
			const blob = new Blob([buffer as BlobPart], { type: 'image/webp' });
			const url = URL.createObjectURL(blob);
			container.createEl('img', { cls: 'witch-media-viewer-img', attr: { src: url, alt: 'Share card preview' } });
			container.createDiv({ cls: 'witch-og-preview-hint', text: 'This is the share card generated when the note is published (unless it has a custom og_image).' });
		} catch (error) {
			container.createDiv({ cls: 'witch-empty', text: `Could not render the card: ${error instanceof Error ? error.message : String(error)}` });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
