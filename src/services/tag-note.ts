import type { TagEntry } from '../types/content';
import { parseYaml, stringifyYaml } from '../utils/yaml';

const STRING_FIELDS = [
	'description',
	'accent_color',
	'feature_image',
	'canonical_url',
	'meta_title',
	'meta_description',
	'og_title',
	'og_description',
	'og_image',
	'twitter_title',
	'twitter_description',
	'twitter_image'
] as const;

function str(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function tagNoteFromText(text: string): TagEntry {
	const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
	if (!match) {
		return { name: '', slug: '' };
	}
	let parsed: Record<string, unknown>;
	try {
		parsed = parseYaml(match[1]);
	} catch {
		return { name: '', slug: '' };
	}

	const entry: Record<string, unknown> = {
		name: str(parsed.name) ?? '',
		slug: str(parsed.slug) ?? ''
	};
	for (const key of STRING_FIELDS) {
		const value = str(parsed[key]);
		if (value !== undefined) {
			entry[key] = value;
		}
	}
	const visibility = str(parsed.visibility);
	if (visibility === 'public' || visibility === 'internal') {
		entry.visibility = visibility;
	}
	return entry as unknown as TagEntry;
}

export function tagNoteFor(entry: TagEntry): string {
	const frontmatter: Record<string, unknown> = {
		name: entry.name,
		slug: entry.slug
	};
	for (const key of STRING_FIELDS) {
		const value = (entry as unknown as Record<string, unknown>)[key];
		if (typeof value === 'string' && value.length > 0) {
			frontmatter[key] = value;
		}
	}
	if (entry.visibility) {
		frontmatter.visibility = entry.visibility;
	}
	const body = `Tag metadata for "${entry.name}". Edit the frontmatter above or use the dashboard.\n`;
	return `---\n${stringifyYaml(frontmatter)}---\n${body}`;
}
