import type { ContentMetadata, TagEntry, TagRegistry } from '../types/content';
import type { WitchSettings } from '../types/settings';
import { generateSlug } from '../utils/slug';
import { isInternalTag } from '../utils/tags';
import type { FileStore } from './file-store';
import { tagNoteFor, tagNoteFromText } from './tag-note';

export interface TagCount {
	slug: string;
	name: string;
	count: number;
}

export interface TagWithCount {
	entry: TagEntry;
	count: number;
}

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

	private sectionSlugs(): string[] {
		return this.settings.sectionTags.map(generateSlug);
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

	scanTagsFrom(notes: Array<Pick<ContentMetadata, 'tags'>>, sectionSlugs: string[] = this.sectionSlugs()): TagCount[] {
		const counts = new Map<string, { name: string; count: number }>();
		for (const note of notes) {
			for (const tag of note.tags ?? []) {
				if (isInternalTag(tag)) {
					continue;
				}
				const slug = generateSlug(tag);
				if (!slug || sectionSlugs.includes(slug)) {
					continue;
				}
				const existing = counts.get(slug);
				if (existing) {
					existing.count += 1;
				} else {
					counts.set(slug, { name: tag.trim(), count: 1 });
				}
			}
		}
		return [...counts.entries()]
			.map(([slug, value]) => ({ slug, name: value.name, count: value.count }))
			.sort((a, b) => b.count - a.count);
	}

	unionTags(notes: Array<Pick<ContentMetadata, 'tags'>>, registry: TagRegistry, sectionSlugs: string[] = this.sectionSlugs()): TagWithCount[] {
		return this.unionCounts(this.scanTagsFrom(notes, sectionSlugs), registry, sectionSlugs);
	}

	unionCounts(counts: TagCount[], registry: TagRegistry, sectionSlugs: string[] = this.sectionSlugs()): TagWithCount[] {
		const countMap = new Map(counts.map((tag): [string, number] => [tag.slug, tag.count]));
		const bySlug = new Map<string, TagEntry>();

		for (const [slug, entry] of Object.entries(registry)) {
			if (sectionSlugs.includes(slug)) {
				continue;
			}
			bySlug.set(slug, entry);
		}
		for (const tag of counts) {
			if (!bySlug.has(tag.slug)) {
				bySlug.set(tag.slug, { name: tag.name, slug: tag.slug });
			}
		}

		return [...bySlug.entries()]
			.map(([slug, entry]) => ({ entry, count: countMap.get(slug) ?? 0 }))
			.sort((a, b) => b.count - a.count || a.entry.name.localeCompare(b.entry.name));
	}
}

