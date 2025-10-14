import MarkdownIt from 'markdown-it';
import { App, Notice, TFile } from 'obsidian';

import { parseFrontmatter } from '../utils/frontmatter-parser';
import { resolveFileByPath } from '../utils/file-resolver';
import { isImageExtension } from '../utils/media';
import type { WitchSettings } from '../types/settings';

interface ConversionOptions {
	currentFile?: TFile;
}

export class MarkdownProcessor {
	constructor(
		private readonly app: App,
		private readonly settings: WitchSettings,
		private readonly md: MarkdownIt
	) {}

	async convertMarkdownToHtml(markdown: string, options: ConversionOptions = {}): Promise<string> {
		let processed = markdown;

		if (this.settings.convertObsidianLinks) {
			processed = await this.convertInternalLinks(processed, options.currentFile);
		}

		if (this.settings.addSourceLink) {
			const vaultName = this.app.vault?.getName?.();
			if (vaultName) {
				processed += `\n\n---\n*Originally published from ${vaultName} vault*`;
			}
		}

		try {
			const html = this.md.render(processed);
			return this.postProcessHtmlForGhostCards(html);
		} catch (error) {
			console.error('Markdown conversion failed, falling back to basic converter:', error);
			return this.postProcessHtmlForGhostCards(this.markdownToHtml(processed));
		}
	}

	private async convertInternalLinks(markdown: string, currentFile?: TFile): Promise<string> {
		let output = markdown.replace(/\[\[([^\]]+?)\]\]/g, (match, linkText) => {
			const parts = String(linkText).split('|');
			const fileName = parts[0].trim();
			const display = parts[1] ? parts[1].trim() : fileName;
			const slug = fileName.toLowerCase().replace(/\s+/g, '-');
			return `[${display}](/${slug})`;
		});

		const embeds = Array.from(output.matchAll(/!\[\[([^\]]+?)\]\]/g));
		for (const match of embeds) {
			const embedPath = match[1];
			const [pathOrName] = embedPath.split('|').map(part => part.trim());

			try {
				const file = await resolveFileByPath(this.app, pathOrName, currentFile);
				if (file && !isImageExtension(file.extension ?? '')) {
					const raw = await this.app.vault.read(file);
					const { markdownContent } = parseFrontmatter(raw);
					output = output.replace(match[0], `\n\n${markdownContent}\n\n`);
				}
			} catch (error) {
				console.error(`Failed to inline embed ${pathOrName}:`, error);
				new Notice(`Failed to inline embed: ${pathOrName}`);
				output = output.replace(match[0], `*[Error processing: ${pathOrName}]*`);
			}
		}

		return output;
	}

	private postProcessHtmlForGhostCards(html: string): string {
		let processed = html;

		processed = processed.replace(/<p>\s*<img([^>]+?)>\s*<\/p>/g, (match, attrs) => {
			const alt = this.extractAlt(attrs);
			return `<figure class="kg-card kg-image-card"><img${attrs}>${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`;
		});

		processed = processed.replace(/(^|\n)(\s*)<img([^>]+?)>(?=\n|$)/g, (match, prefix, spaces, attrs) => {
			const alt = this.extractAlt(attrs);
			return `${prefix}${spaces}<figure class="kg-card kg-image-card"><img${attrs}>${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`;
		});

		processed = processed.replace(/<p>\s*<a href="(https?:\/\/[^\"]+)">\1<\/a>\s*<\/p>/g, (match, url) => {
			const youtube = this.youtubeEmbed(url);
			if (youtube) {
				return `<figure class="kg-card kg-embed-card">${youtube}</figure>`;
			}
			const vimeo = this.vimeoEmbed(url);
			if (vimeo) {
				return `<figure class="kg-card kg-embed-card">${vimeo}</figure>`;
			}
			return match;
		});

		return processed;
	}

	private youtubeEmbed(url: string): string | null {
		const watch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/);
		const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
		const shorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
		const id = (watch && watch[1]) || (short && short[1]) || (shorts && shorts[1]);
		if (!id) {
			return null;
		}
		return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
	}

	private vimeoEmbed(url: string): string | null {
		const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
		if (!match) {
			return null;
		}
		return `<iframe src="https://player.vimeo.com/video/${match[1]}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
	}

	private extractAlt(attrs: string): string {
		const altMatch = attrs.match(/alt="([^"]*)"/);
		return altMatch ? altMatch[1] : '';
	}

	private markdownToHtml(markdown: string): string {
		let html = markdown;
		html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
		html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
		html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
		html = html.replace(/\n\n/g, '</p><p>');
		html = html.replace(/\n/g, '<br>');
		html = `<p>${html}</p>`;
		return html.replace(/<p><\/p>/g, '');
	}
}
