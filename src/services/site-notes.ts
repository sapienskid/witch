import { App, TFile, TFolder } from 'obsidian';

import type { ContentMetadata } from '../types/content';
import { parseFrontmatter } from '../utils/frontmatter-parser';

const METADATA_FILES = new Set(['settings.md', 'tags.md']);

export interface SiteNote {
	file: TFile;
	metadata: ContentMetadata;
}

export async function readSiteNotes(app: App, folder: string): Promise<SiteNote[]> {
	const folderAbs = app.vault.getAbstractFileByPath(folder);
	if (!(folderAbs instanceof TFolder)) {
		return [];
	}

	const notes: SiteNote[] = [];
	for (const child of folderAbs.children) {
		if (!(child instanceof TFile) || child.extension !== 'md' || METADATA_FILES.has(child.name)) {
			continue;
		}
		const raw = await app.vault.read(child);
		const { metadata } = parseFrontmatter(raw);
		notes.push({ file: child, metadata });
	}
	return notes;
}
