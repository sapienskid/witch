import type { TagEntry, TagRegistry } from '../types/content';
import type { WitchSettings } from '../types/settings';
import { generateSlug } from '../utils/slug';
import { isInternalTag } from '../utils/tags';
import type { FileStore } from './file-store';
import { tagNoteFor, tagNoteFromText } from './tag-note';

export class TagManager {
	constructor(
		private readonly settings: WitchSettings,
		private readonly store: FileStore
	) {}

	private tagsFolder(): string {
		return `${this.settings.siteFolder}/tags`;
	}

	private tagPath(slug: string): string {
		return `${this.tagsFolder()}/${slug}.md`;
	}

	async listTags(): Promise<TagEntry[]> {
		const paths = await this.store.listNotes(this.tagsFolder());
		const entries: TagEntry[] = [];
		for (const path of paths) {
			const raw = await this.store.readText(path);
			if (raw === null) {
				continue;
			}
			const entry = tagNoteFromText(raw);
			if (entry.name && entry.slug) {
				entries.push(entry);
			}
		}
		return entries;
	}

	async getRegistry(): Promise<TagRegistry> {
		const entries = await this.listTags();
		const registry: TagRegistry = {};
		for (const entry of entries) {
			registry[entry.slug] = entry;
		}
		return registry;
	}

	async saveRegistry(registry: TagRegistry): Promise<void> {
		for (const entry of Object.values(registry)) {
			await this.saveEntry(entry);
		}
	}

	async saveEntry(entry: TagEntry): Promise<void> {
		await this.store.writeText(this.tagPath(entry.slug), tagNoteFor(entry));
	}

	async deleteTag(slug: string): Promise<void> {
		await this.store.deleteFile(this.tagPath(slug));
	}

	async ensureTags(tags: string[]): Promise<TagRegistry> {
		const registry = await this.getRegistry();
		let changed = false;
		for (const tag of tags) {
			if (isInternalTag(tag)) {
				continue;
			}
			const slug = generateSlug(tag);
			if (!slug || registry[slug]) {
				continue;
			}
			registry[slug] = { name: tag.trim(), slug };
			changed = true;
		}
		if (changed) {
			await this.saveRegistry(registry);
		}
		return registry;
	}
}

