import { App, TFile } from 'obsidian';

import { parseFrontmatter } from '../utils/frontmatter-parser';
import { resolveFileByPath } from '../utils/file-resolver';
import { isImageExtension } from '../utils/media';
import { generateSlug } from '../utils/slug';
import type { WitchSettings } from '../types/settings';
import type { R2StorageService } from './r2-storage';

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

		if (this.settings.convertObsidianLinks) {
			output = await this.convertInternalLinks(output, file);
		}

		return output;
	}

	private async convertInternalLinks(markdown: string, currentFile: TFile): Promise<string> {
		let output = markdown;

		const embeds = Array.from(output.matchAll(/!\[\[([^\]]+?)\]\]/g));
		for (const match of embeds) {
			const [pathOrName] = String(match[1]).split('|').map(part => part.trim());
			const file = await resolveFileByPath(this.app, pathOrName, currentFile);
			if (file && file.extension && !isImageExtension(file.extension)) {
				const raw = await this.app.vault.read(file);
				const { markdownContent } = parseFrontmatter(raw);
				output = output.replace(match[0], `\n\n${markdownContent}\n\n`);
			}
		}

		return output.replace(/\[\[([^\]]+?)\]\]/g, (match, linkText: string) => {
			const parts = linkText.split('|');
			const fileName = parts[0].trim();
			const display = parts[1] ? parts[1].trim() : fileName;
			const slug = generateSlug(fileName);
			return `[${display}](/${slug})`;
		});
	}
}
