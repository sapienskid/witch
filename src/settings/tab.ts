import { App, Notice, PluginSettingTab, Setting, requestUrl, type RequestUrlParam } from 'obsidian';

import type WitchPlugin from '../../main';
import type { PublishStatus, PostVisibility } from '../types/settings';

export class WitchSettingTab extends PluginSettingTab {
    constructor(app: App, private readonly plugin: WitchPlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Witch - Ghost Publisher Settings' });

        const tabNav = containerEl.createEl('div', { cls: 'witch-tab-nav' });
        const tabContent = containerEl.createEl('div', { cls: 'witch-tab-content' });

        const tabs = [
            { id: 'ghost', label: 'Ghost Setup' },
            { id: 'publishing', label: 'Publishing' },
            { id: 'r2', label: 'Cloudflare R2' },
            { id: 'advanced', label: 'Advanced' },
            { id: 'guide', label: 'Guide' }
        ];

        let activeTab = 'ghost';

        const showTab = (tabId: string) => {
            activeTab = tabId;
            tabContent.empty();

            tabNav.querySelectorAll('.witch-tab-button').forEach(btn => btn.removeClass('active'));
            tabNav.querySelector(`[data-tab="${tabId}"]`)?.addClass('active');

            switch (tabId) {
                case 'ghost':
                    this.renderGhostTab(tabContent);
                    break;
                case 'publishing':
                    this.renderPublishingTab(tabContent);
                    break;
                case 'r2':
                    this.renderR2Tab(tabContent);
                    break;
                case 'advanced':
                    this.renderAdvancedTab(tabContent);
                    break;
                case 'guide':
                    this.renderGuideTab(tabContent);
                    break;
            }
        };

        tabs.forEach(tab => {
            const button = tabNav.createEl('button', { cls: 'witch-tab-button', text: tab.label });
            button.setAttribute('data-tab', tab.id);
            if (tab.id === activeTab) {
                button.addClass('active');
            }
            button.addEventListener('click', () => showTab(tab.id));
        });

        showTab(activeTab);
        this.injectStyles();
    }

    private renderGhostTab(containerEl: HTMLElement): void {
        const section = containerEl.createEl('div', { cls: 'setting-section' });
        section.createEl('h3', { text: 'Ghost Site Configuration' });

        new Setting(section)
            .setName('Ghost Site URL')
            .setDesc('Your Ghost site URL (e.g., https://yourblog.ghost.io)')
            .addText(text => text
                .setPlaceholder('https://yourblog.ghost.io')
                .setValue(this.plugin.settings.ghostSiteUrl)
                .onChange(async value => {
                    this.plugin.settings.ghostSiteUrl = value.replace(/\/$/, '');
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('Admin API Key')
            .setDesc('Your Ghost Admin API key (format: keyId:secret)')
            .addText(text => {
                text.setPlaceholder('keyId:secret')
                    .setValue(this.plugin.settings.adminApiKey)
                    .onChange(async value => {
                        this.plugin.settings.adminApiKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = 'password';
                return text;
            });

        new Setting(section)
            .setName('Test Ghost Connection')
            .setDesc('Test the connection to your Ghost site and validate API key')
            .addButton(button => {
                button.setButtonText('Test Connection').onClick(async () => {
                    try {
                        button.setButtonText('Testing...');

                        if (!this.plugin.settings.ghostSiteUrl || !this.plugin.settings.adminApiKey) {
                            new Notice('Please configure Ghost site URL and Admin API key first');
                            return;
                        }

                        const jwt = await this.plugin.ghostApi.generateJWT();
                        const params: RequestUrlParam = {
                            url: `${this.plugin.settings.ghostSiteUrl}/ghost/api/admin/site/`,
                            method: 'GET',
                            headers: {
                                Authorization: `Ghost ${jwt}`,
                                'Content-Type': 'application/json'
                            }
                        };

                        const response = await requestUrl(params);

                        if (response.status === 200) {
                            new Notice('✅ Ghost connection successful!');
                            if (this.plugin.settings.debugMode) {
                                console.log('Site info:', response.json);
                            }
                        } else {
                            new Notice(`❌ Connection failed: HTTP ${response.status}`);
                            console.error('Ghost API error:', response);
                        }
                    } catch (error) {
                        new Notice(`❌ Connection failed: ${error.message}`);
                        console.error('Ghost connection test error:', error);
                    } finally {
                        button.setButtonText('Test Connection');
                    }
                });
            });
    }

    private renderPublishingTab(containerEl: HTMLElement): void {
        const section = containerEl.createEl('div', { cls: 'setting-section' });
        section.createEl('h3', { text: 'Publishing Settings' });

        new Setting(section)
            .setName('Default Status')
            .setDesc('Default publishing status for new posts')
            .addDropdown(dropdown => dropdown
                .addOption('draft', 'Draft')
                .addOption('published', 'Published')
                .addOption('scheduled', 'Scheduled')
                .setValue(this.plugin.settings.defaultStatus)
                .onChange(async value => {
                    this.plugin.settings.defaultStatus = value as PublishStatus;
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('Default Author')
            .setDesc('Default author(s) for posts. Use comma-separated emails or slugs (leave empty for Ghost default).')
            .addText(text => text
                .setPlaceholder('you@example.com, teammate@example.com')
                .setValue(this.plugin.settings.defaultAuthor)
                .onChange(async value => {
                    this.plugin.settings.defaultAuthor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('Default Tags')
            .setDesc('Default tags for posts (comma-separated)')
            .addText(text => text
                .setPlaceholder('obsidian, notes, blog')
                .setValue(this.plugin.settings.defaultTags)
                .onChange(async value => {
                    this.plugin.settings.defaultTags = value;
                    await this.plugin.saveSettings();
                }));

        const contentSection = containerEl.createEl('div', { cls: 'setting-section' });
        contentSection.createEl('h3', { text: 'Content Processing' });

        new Setting(contentSection)
            .setName('Convert Obsidian Links')
            .setDesc('Convert [[wikilinks]] to standard markdown links')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.convertObsidianLinks)
                .onChange(async value => {
                    this.plugin.settings.convertObsidianLinks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(contentSection)
            .setName('Add Source Link')
            .setDesc('Add a footer note indicating the content came from Obsidian')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addSourceLink)
                .onChange(async value => {
                    this.plugin.settings.addSourceLink = value;
                    await this.plugin.saveSettings();
                }));
    }



    private renderR2Tab(containerEl: HTMLElement): void {
        const section = containerEl.createEl('div', { cls: 'setting-section' });
        section.createEl('h3', { text: 'Cloudflare R2 Storage' });

        new Setting(section)
            .setName('Enable R2 Upload')
            .setDesc('Upload embedded images to Cloudflare R2 storage')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableR2Upload)
                .onChange(async value => {
                    this.plugin.settings.enableR2Upload = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (!this.plugin.settings.enableR2Upload) {
            return;
        }

        new Setting(section)
            .setName('R2 Account ID')
            .setDesc('Your Cloudflare account ID (found in Cloudflare dashboard)')
            .addText(text => text
                .setPlaceholder('1234567890abcdef1234567890abcdef')
                .setValue(this.plugin.settings.r2AccountId)
                .onChange(async value => {
                    this.plugin.settings.r2AccountId = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('R2 Access Key ID')
            .setDesc('R2 API token access key ID')
            .addText(text => text
                .setPlaceholder('R2 Access Key ID')
                .setValue(this.plugin.settings.r2AccessKeyId)
                .onChange(async value => {
                    this.plugin.settings.r2AccessKeyId = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('R2 Secret Access Key')
            .setDesc('R2 API token secret access key')
            .addText(text => {
                text.setPlaceholder('R2 Secret Access Key')
                    .setValue(this.plugin.settings.r2SecretAccessKey)
                    .onChange(async value => {
                        this.plugin.settings.r2SecretAccessKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = 'password';
                return text;
            });

        new Setting(section)
            .setName('R2 Bucket Name')
            .setDesc('Name of your R2 bucket for storing images')
            .addText(text => text
                .setPlaceholder('my-images-bucket')
                .setValue(this.plugin.settings.r2BucketName)
                .onChange(async value => {
                    this.plugin.settings.r2BucketName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('Custom Domain (Optional)')
            .setDesc('Custom domain for your R2 bucket (e.g., images.yourdomain.com)')
            .addText(text => text
                .setPlaceholder('images.yourdomain.com')
                .setValue(this.plugin.settings.r2CustomDomain)
                .onChange(async value => {
                    this.plugin.settings.r2CustomDomain = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('Image Path Prefix')
            .setDesc('Folder path in bucket to store images (e.g., "images" or "blog/images")')
            .addText(text => text
                .setPlaceholder('images')
                .setValue(this.plugin.settings.r2ImagePath)
                .onChange(async value => {
                    this.plugin.settings.r2ImagePath = value || 'images';
                    await this.plugin.saveSettings();
                }));

        new Setting(section)
            .setName('Test Connection')
            .setDesc('Test your R2 credentials by uploading a small test file')
            .addButton(button => button
                .setButtonText('Test R2 Connection')
                .onClick(async () => {
                    if (!this.plugin.settings.r2AccountId || !this.plugin.settings.r2AccessKeyId || !this.plugin.settings.r2SecretAccessKey || !this.plugin.settings.r2BucketName) {
                        new Notice('Please fill in all R2 credentials first');
                        return;
                    }

                    new Notice('Testing R2 connection...');
                    const ok = await this.plugin.r2Service.testConnection();
                    if (ok) {
                        new Notice('✅ R2 connection successful!');
                    } else {
                        new Notice('❌ Failed to connect to R2. Check console for details.');
                    }
                }));

        const guide = section.createEl('div', { cls: 'witch-guide' });
        guide.innerHTML = `
            <h4>Setup Cloudflare R2:</h4>
            <ol>
                <li>Go to <strong>Cloudflare Dashboard → R2 Object Storage</strong></li>
                <li>Create a new bucket for your images</li>
                <li>Go to <strong>R2 → Manage R2 API tokens</strong></li>
                <li>Create a new API token with <strong>Object Read & Write</strong> permissions</li>
                <li>Copy the <strong>Access Key ID</strong> and <strong>Secret Access Key</strong></li>
                <li>Optional: Set up a custom domain for your bucket</li>
            </ol>
            <p><strong>Benefits of R2:</strong> Much cheaper than Cloudflare Images, no file size limits, full control over your images.</p>
        `;
    }

    private renderAdvancedTab(containerEl: HTMLElement): void {
        const section = containerEl.createEl('div', { cls: 'setting-section' });
        section.createEl('h3', { text: 'Advanced Settings' });

        new Setting(section)
            .setName('Debug Mode')
            .setDesc('Enable verbose logging for troubleshooting')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async value => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }

    private renderGuideTab(containerEl: HTMLElement): void {
        const section = containerEl.createEl('div', { cls: 'setting-section' });
        section.createEl('h3', { text: 'Frontmatter Guide' });

        const guide = section.createEl('div', { cls: 'witch-guide' });
        guide.innerHTML = `
            <p>You can control your Ghost posts using frontmatter in your notes. Here are the supported fields:</p>
            <ul>
                <li><strong>title:</strong> Post title (defaults to note name)</li>
                <li><strong>status:</strong> draft, published, or scheduled</li>
                <li><strong>slug:</strong> URL slug (auto-generated if not provided)</li>
                <li><strong>tags:</strong> Comma-separated list of tags</li>
                <li><strong>featured:</strong> true/false for featured posts</li>
                <li><strong>feature_image:</strong> URL to featured image</li>
                <li><strong>excerpt:</strong> Post excerpt</li>
                <li><strong>visibility:</strong> public, members, or paid</li>
                <li><strong>published_at:</strong> Schedule publication (ISO format)</li>
                <li><strong>meta_title:</strong> SEO title</li>
                <li><strong>meta_description:</strong> SEO description</li>
            </ul>
            <p><em>Authors are configured globally via the Witch settings panel.</em></p>
            <p><strong>Example frontmatter:</strong></p>
            <pre>---
title: My Amazing Blog Post
status: published
tags: [technology, ai, future]
featured: true
excerpt: This is a fascinating exploration of AI technology.
visibility: public
---</pre>
        `;

    }



    private injectStyles() {
        if (document.head.querySelector('style[data-witch-settings]')) {
            return;
        }

        const style = document.createElement('style');
        style.setAttribute('data-witch-settings', '');
        style.textContent = `
            .witch-tab-nav {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
                border-bottom: 2px solid var(--background-modifier-border);
                padding-bottom: 0;
            }
            .witch-tab-button {
                background: transparent;
                border: none;
                padding: 10px 20px;
                cursor: pointer;
                color: var(--text-muted);
                font-size: 14px;
                font-weight: 500;
                border-bottom: 2px solid transparent;
                margin-bottom: -2px;
                transition: all 0.2s ease;
            }
            .witch-tab-button:hover {
                color: var(--text-normal);
                background: var(--background-modifier-hover);
            }
            .witch-tab-button.active {
                color: var(--text-accent);
                border-bottom-color: var(--text-accent);
            }
            .witch-tab-content {
                margin-top: 20px;
            }
            .setting-section {
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .setting-section:last-child {
                border-bottom: none;
            }
            .witch-guide {
                background-color: var(--background-primary-alt);
                border-radius: 5px;
                padding: 15px;
                margin: 10px 0;
            }
            .witch-guide ul {
                margin: 10px 0;
                padding-left: 20px;
            }
            .witch-guide pre {
                background-color: var(--background-secondary);
                padding: 10px;
                border-radius: 3px;
                margin: 10px 0;
                font-size: 0.9em;
            }

        `;

        document.head.appendChild(style);
    }
}
