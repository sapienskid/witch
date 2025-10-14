import { App, TFile } from 'obsidian';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

export async function resolveFileByPath(app: App, path: string, currentFile?: TFile): Promise<TFile | null> {
	let file = app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) {
		return file;
	}

	if (currentFile) {
		const relative = app.metadataCache.getFirstLinkpathDest(path, currentFile.path);
		if (relative instanceof TFile) {
			return relative;
		}
	}

	const root = app.metadataCache.getFirstLinkpathDest(path, '');
	if (root instanceof TFile) {
		return root;
	}

	for (const ext of IMAGE_EXTENSIONS) {
		const withExt = `${path}.${ext}`;

		file = app.vault.getAbstractFileByPath(withExt);
		if (file instanceof TFile) {
			return file;
		}

		if (currentFile) {
			const relative = app.metadataCache.getFirstLinkpathDest(withExt, currentFile.path);
			if (relative instanceof TFile) {
				return relative;
			}
		}
	}

	const lowerName = path.toLowerCase();
	const match = app.vault.getFiles().find(candidate => {
		const fileName = candidate.name.toLowerCase();
		const filePath = candidate.path.toLowerCase();
		return fileName === lowerName || filePath === lowerName || filePath.includes(lowerName);
	});

	return match ?? null;
}
