import { App, TFile, TFolder, normalizePath } from 'obsidian';

export interface FileStore {
	readText(path: string): Promise<string | null>;
	writeText(path: string, content: string): Promise<void>;
	deleteFile(path: string): Promise<void>;
	listNotes(dir: string): Promise<string[]>;
}

export class ObsidianFileStore implements FileStore {
	constructor(private readonly app: App) {}

	async readText(path: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		return file instanceof TFile ? this.app.vault.read(file) : null;
	}

	async writeText(path: string, content: string): Promise<void> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		if (file instanceof TFile) {
			await this.app.vault.process(file, () => content);
			return;
		}
		await this.ensureFolder(normalized.split('/').slice(0, -1).join('/'));
		await this.app.vault.create(normalized, content);
	}

	async deleteFile(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (file instanceof TFile) {
			await this.app.fileManager.trashFile(file);
		}
	}

	async listNotes(dir: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(normalizePath(dir));
		if (!(folder instanceof TFolder)) {
			return [];
		}
		return folder.children
			.filter((child): child is TFile => child instanceof TFile && child.extension === 'md')
			.map(file => file.path);
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
