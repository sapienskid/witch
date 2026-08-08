import { App, Modal, Notice } from 'obsidian';

export class ImageViewerModal extends Modal {
	constructor(
		app: App,
		private readonly url: string,
		private readonly name: string
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('witch-modal');
		this.contentEl.empty();

		const img = this.contentEl.createEl('img', {
			cls: 'witch-media-viewer-img',
			attr: { src: this.url, alt: this.name }
		});
		img.setAttr('referrerpolicy', 'no-referrer');
		this.contentEl.createDiv({ cls: 'witch-media-name', text: this.name });

		const footer = this.contentEl.createDiv({ cls: 'witch-modal-footer' });
		footer.createEl('button', { cls: 'witch-tab-button', text: 'Copy URL' }).addEventListener('click', () => {
			void navigator.clipboard.writeText(this.url);
			new Notice('URL copied');
		});
		footer.createEl('button', { cls: 'witch-tab-button', text: 'Open in browser' }).addEventListener('click', () => {
			window.open(this.url, '_blank');
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
