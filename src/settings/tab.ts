import { App, Notice, PluginSettingTab, Setting, requestUrl } from 'obsidian';
import type { SettingDefinitionItem, SettingDefinitionRender } from 'obsidian';

import type WitchPlugin from '../../main';
import { splitTags } from '../utils/slug';

export class WitchSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: WitchPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Connection',
				items: [
					{
						name: 'Content API URL',
						desc: 'Base URL of the witch-worker content API.',
						control: {
							type: 'text',
							key: 'contentApiUrl',
							placeholder: 'https://witch-worker.your-subdomain.workers.dev'
						}
					},
					this.secretSetting('Content API token', 'Bearer token the worker requires for writes.', 'contentApiToken'),
					{
						name: 'Site folder',
						desc: 'Vault folder that holds published notes.',
						control: {
							type: 'folder',
							key: 'siteFolder'
						}
					},
					{
						name: 'Routing tags',
						desc: 'Comma-separated tags that decide where posts are published.',
						control: {
							type: 'text',
							key: 'sectionTags',
							placeholder: 'blog, portfolio, flashcards'
						}
					},
					{
						name: 'Test connection',
						desc: 'Fetch the content manifest from the worker.',
						action: () => {
							void this.testConnection();
						}
					}
				]
			},
			{
				type: 'group',
				heading: 'Publishing',
				items: [
					{
						name: 'Convert Obsidian links',
						desc: 'Rewrite [[wikilinks]] to site links before publishing.',
						control: {
							type: 'toggle',
							key: 'convertObsidianLinks'
						}
					}
				]
			},
			{
				type: 'group',
				heading: 'Storage',
				items: [
					{
						name: 'Enable R2 upload',
						desc: 'Upload embedded images to Cloudflare R2.',
						control: {
							type: 'toggle',
							key: 'enableR2Upload'
						}
					},
					{
						name: 'R2 account ID',
						control: {
							type: 'text',
							key: 'r2AccountId',
							placeholder: '1234567890abcdef1234567890abcdef'
						},
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'R2 access key ID',
						render: setting => this.renderSecret(setting, 'r2AccessKeyId'),
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'R2 secret access key',
						render: setting => this.renderSecret(setting, 'r2SecretAccessKey'),
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'R2 bucket name',
						control: {
							type: 'text',
							key: 'r2BucketName',
							placeholder: 'witch-worker'
						},
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'Custom domain',
						desc: 'Public domain for uploaded images (optional).',
						control: {
							type: 'text',
							key: 'r2CustomDomain',
							placeholder: 'images.yourdomain.com'
						},
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'Image path prefix',
						desc: 'Folder in the bucket used for images.',
						control: {
							type: 'text',
							key: 'r2ImagePath',
							placeholder: 'images'
						},
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'Test R2 connection',
						desc: 'Verify the R2 credentials.',
						action: () => {
							void this.testR2();
						},
						visible: () => this.plugin.settings.enableR2Upload
					},
					{
						name: 'Enable image optimization',
						desc: 'Convert and resize images before uploading.',
						control: {
							type: 'toggle',
							key: 'enableImageOptimization'
						}
					},
					{
						name: 'Image format',
						control: {
							type: 'dropdown',
							key: 'imageFormat',
							options: { webp: 'WebP', jpeg: 'JPEG', png: 'PNG', original: 'Original' }
						},
						visible: () => this.plugin.settings.enableImageOptimization
					},
					{
						name: 'Image quality',
						desc: 'Compression quality (higher is larger).',
						control: {
							type: 'slider',
							key: 'imageQuality',
							min: 1,
							max: 100,
							step: 1
						},
						visible: () => this.plugin.settings.enableImageOptimization
					},
					{
						name: 'Maximum width',
						desc: 'Resize wider images to this many pixels (0 = no limit).',
						control: {
							type: 'number',
							key: 'maxImageWidth',
							placeholder: '1920',
							min: 0
						},
						visible: () => this.plugin.settings.enableImageOptimization
					},
					{
						name: 'Maximum height',
						desc: 'Resize taller images to this many pixels (0 = no limit).',
						control: {
							type: 'number',
							key: 'maxImageHeight',
							placeholder: '0',
							min: 0
						},
						visible: () => this.plugin.settings.enableImageOptimization
					}
				]
			},
			{
				type: 'group',
				heading: 'Advanced',
				items: [
					{
						name: 'Debug mode',
						desc: 'Log extra details to the console.',
						control: {
							type: 'toggle',
							key: 'debugMode'
						}
					}
				]
			}
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'sectionTags') {
			return this.plugin.settings.sectionTags.join(', ');
		}
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'sectionTags') {
			this.plugin.settings.sectionTags = splitTags(String(value));
		} else {
			(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		}
		await this.plugin.saveSettings();
		if (key === 'enableR2Upload' || key === 'enableImageOptimization') {
			this.update();
		}
	}

	private secretSetting(name: string, desc: string, key: string): SettingDefinitionRender {
		return {
			name,
			desc,
			render: setting => this.renderSecret(setting, key)
		};
	}

	private renderSecret(setting: Setting, key: string): void {
		let inputEl: HTMLInputElement | undefined;
		let revealed = false;
		setting.addText(text => {
			inputEl = text.inputEl;
			inputEl.type = 'password';
			const current = (this.plugin.settings as unknown as Record<string, unknown>)[key];
			text.setValue(typeof current === 'string' ? current : '');
			text.onChange(async value => {
				(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
				await this.plugin.saveSettings();
			});
		});
		if (inputEl) {
			setting.addExtraButton(button => {
				button.setIcon('eye').setTooltip('Show or hide');
				button.onClick(() => {
					revealed = !revealed;
					if (inputEl) {
						inputEl.type = revealed ? 'text' : 'password';
					}
					button.setIcon(revealed ? 'eye-off' : 'eye');
				});
			});
		}
	}

	private async testConnection(): Promise<void> {
		try {
			const response = await requestUrl({
				url: `${this.plugin.settings.contentApiUrl.replace(/\/+$/, '')}/api/manifest`,
				method: 'GET',
				headers: { Authorization: `Bearer ${this.plugin.settings.contentApiToken}` }
			});
			if (response.status === 200) {
				new Notice('Connection successful');
			} else {
				new Notice(`Connection failed (HTTP ${response.status})`);
			}
		} catch (error) {
			new Notice(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async testR2(): Promise<void> {
		const ok = await this.plugin.r2Service.testConnection();
		new Notice(ok ? 'R2 connection successful' : 'R2 connection failed');
	}
}
