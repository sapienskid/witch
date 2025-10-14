import { Notice, Plugin, TFile, type Editor } from 'obsidian';
import MarkdownIt from 'markdown-it';

import { DEFAULT_SETTINGS, type WitchSettings } from './src/types/settings';
import { parseFrontmatter } from './src/utils/frontmatter-parser';
import { MarkdownProcessor } from './src/services/markdown-processor';
import { R2StorageService } from './src/services/r2-storage';
import { GhostApiClient } from './src/services/ghost-api';
import { PostBuilder } from './src/services/post-builder';
import { WitchSettingTab } from './src/settings/tab';

export default class WitchPlugin extends Plugin {
    settings: WitchSettings;
    markdownRenderer: MarkdownIt;
    markdownProcessor: MarkdownProcessor;
    r2Service: R2StorageService;
    ghostApi: GhostApiClient;
    postBuilder: PostBuilder;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.markdownRenderer = new MarkdownIt({
            html: true,
            linkify: true,
            breaks: false
        });

        this.markdownProcessor = new MarkdownProcessor(this.app, this.settings, this.markdownRenderer);
        this.r2Service = new R2StorageService(this.app, this.settings);
        this.ghostApi = new GhostApiClient(this.settings);
        this.postBuilder = new PostBuilder(this.settings);

        this.addRibbonIcon('send', 'Publish to Ghost', () => this.publishActiveNote());

        this.addCommand({
            id: 'publish-to-ghost',
            name: 'Publish current note to Ghost',
            callback: () => this.publishActiveNote()
        });


        this.addCommand({
            id: 'upload-embeds-to-r2',
            name: 'Upload embedded images to R2 and replace in note',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('No active file');
                    return;
                }
                await this.uploadEmbedsInNoteToR2(activeFile);
            }
        });

        this.addSettingTab(new WitchSettingTab(this.app, this));
    }

    onunload(): void {
        console.log('Unloading Witch plugin');
    }



    private async publishActiveNote(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file to publish');
            return;
        }
        await this.publishToGhost(activeFile);
    }

    async publishToGhost(file: TFile): Promise<void> {
        if (!this.settings.ghostSiteUrl || !this.settings.adminApiKey) {
            new Notice('Please configure Ghost site URL and Admin API key in settings');
            return;
        }

        try {
            const raw = await this.app.vault.read(file);
            const { metadata, markdownContent } = parseFrontmatter(raw);

            let processedMarkdown = markdownContent;
            if (this.r2Service.shouldUseR2()) {
                const { processedContent, uploadedCount } = await this.r2Service.processAllImagesInContent(markdownContent, file, {
                    uploadToR2: true,
                    replaceInOriginal: false
                });
                processedMarkdown = processedContent;
                if (uploadedCount > 0) {
                    new Notice(`Uploaded ${uploadedCount} image${uploadedCount === 1 ? '' : 's'} to R2`);
                }
            }

            const htmlContent = await this.markdownProcessor.convertMarkdownToHtml(processedMarkdown, {
                currentFile: file
            });

            const ghostPost = this.postBuilder.prepareGhostPost(file, metadata, htmlContent);

            if (this.settings.debugMode) {
                console.log('Prepared Ghost post:', JSON.stringify(ghostPost, null, 2));
            }

            const identifier = ghostPost.slug ?? ghostPost.title;
            const existingPost = await this.ghostApi.findExistingPost(identifier);

            if (existingPost) {
                await this.ghostApi.updateGhostPost(existingPost.id!, {
                    ...ghostPost,
                    updated_at: existingPost.updated_at
                });
                new Notice(`Post "${ghostPost.title}" updated successfully on Ghost`);
            } else {
                await this.ghostApi.createGhostPost(ghostPost);
                new Notice(`Post "${ghostPost.title}" published to Ghost`);
            }
        } catch (error) {
            console.error('Error publishing to Ghost:', error);
            if (error?.message?.includes('422')) {
                const details = await this.ghostApi.getDetailedError(error);
                new Notice(`Ghost validation error: ${details}`);
            } else {
                new Notice(`Error publishing to Ghost: ${error?.message ?? 'Unknown error'}`);
            }
        }
    }

    async uploadEmbedsInNoteToR2(file: TFile): Promise<void> {
        if (!this.r2Service.shouldUseR2()) {
            new Notice('Enable R2 and fill all credentials in settings');
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const { processedContent, uploadedCount } = await this.r2Service.processAllImagesInContent(content, file, {
                uploadToR2: true,
                replaceInOriginal: true
            });

            if (uploadedCount > 0) {
                await this.app.vault.modify(file, processedContent);
                new Notice(`Replaced ${uploadedCount} image${uploadedCount === 1 ? '' : 's'} with R2 URLs`);
            } else {
                new Notice('No local images were uploaded to R2');
            }
        } catch (error) {
            console.error('Failed to upload embeds to R2:', error);
            new Notice(`Error: ${error?.message ?? 'Unknown error'}`);
        }
    }



    async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);


    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
