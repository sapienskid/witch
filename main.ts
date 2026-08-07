import { Notice, Plugin, TFile } from 'obsidian';

import { ContentApiClient } from './src/services/content-api';
import { ObsidianFileStore } from './src/services/file-store';
import { MarkdownProcessor } from './src/services/markdown-processor';
import { obsidianRequest } from './src/services/obsidian-transport';
import { Publisher } from './src/services/publisher';
import { R2StorageService } from './src/services/r2-storage';
import { SiteBuilder } from './src/services/site-builder';
import { SiteSettingsService } from './src/services/site-settings';
import { TagManager } from './src/services/tag-manager';
import { WitchSettingTab } from './src/settings/tab';
import { DEFAULT_SETTINGS, type WitchSettings } from './src/types/settings';
import { WitchDashboardView, WITCH_VIEW_TYPE } from './src/views/dashboard';
import { NewNoteModal, NoteSettingsModal } from './src/views/modals';

export default class WitchPlugin extends Plugin {
	settings: WitchSettings = DEFAULT_SETTINGS;
	contentApi: ContentApiClient;
	fileStore: ObsidianFileStore;
	r2Service: R2StorageService;
	markdownProcessor: MarkdownProcessor;
	siteBuilder: SiteBuilder;
	tagManager: TagManager;
	siteSettings: SiteSettingsService;
	publisher: Publisher;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.contentApi = new ContentApiClient(this.settings, obsidianRequest);
		this.fileStore = new ObsidianFileStore(this.app);
		this.r2Service = new R2StorageService(this.app, this.settings);
		this.markdownProcessor = new MarkdownProcessor(this.app, this.settings, this.r2Service);
		this.siteBuilder = new SiteBuilder(this.app, this.settings, this.markdownProcessor, this.r2Service);
		this.tagManager = new TagManager(this.settings, this.fileStore);
		this.siteSettings = new SiteSettingsService(this);
		this.publisher = new Publisher(this.app, this.settings, this.contentApi, this.siteBuilder, this.tagManager, this.siteSettings, () => this.saveSettings());

		this.registerView(WITCH_VIEW_TYPE, leaf => new WitchDashboardView(leaf, this));

		this.addRibbonIcon('settings-2', 'Open content dashboard', () => void this.openDashboard());

		this.addCommand({
			id: 'open-cms-dashboard',
			name: 'Open content dashboard',
			callback: () => void this.openDashboard()
		});

		this.addCommand({
			id: 'publish-current-note',
			name: 'Publish current note',
			callback: () => void this.publishActiveNote()
		});

		this.addCommand({
			id: 'create-post',
			name: 'Create new post',
			callback: () => {
				new NewNoteModal(this.app, this, 'post').open();
			}
		});

		this.addCommand({
			id: 'create-page',
			name: 'Create new page',
			callback: () => {
				new NewNoteModal(this.app, this, 'page').open();
			}
		});

		this.addCommand({
			id: 'edit-current-note',
			name: 'Edit note settings',
			checkCallback: checking => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) {
					return false;
				}
				if (!checking) {
					new NoteSettingsModal(this.app, this, file).open();
				}
				return true;
			}
		});

		this.addSettingTab(new WitchSettingTab(this.app, this));
	}

	onunload(): void {
		// Resources registered via registerView/addCommand/addSettingTab clean up themselves.
	}

	private async openDashboard(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(WITCH_VIEW_TYPE);
		if (leaves.length > 0) {
			void this.app.workspace.revealLeaf(leaves[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: WITCH_VIEW_TYPE, active: true });
	}

	private async publishActiveNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active file to publish');
			return;
		}
		try {
			await this.publisher.publish(file);
		} catch (error) {
			new Notice(`Publish failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<WitchSettings> | undefined;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
