import type { ContentMetadata } from '../types/content';
import type { PublishStatus } from '../types/settings';
import { parseYaml } from './yaml';

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

function asString(parsed: Record<string, unknown>, key: string): string | undefined {
	const value = parsed[key];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(parsed: Record<string, unknown>, key: string): string[] | undefined {
	const value = parsed[key];
	if (Array.isArray(value)) {
		const items = value.map(item => String(item)).filter(item => item.length > 0);
		return items.length > 0 ? items : undefined;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? [trimmed] : undefined;
	}
	return undefined;
}

export function parseFrontmatter(content: string): { metadata: ContentMetadata; markdownContent: string } {
	const match = content.match(FRONTMATTER_REGEX);

	if (!match) {
		return { metadata: {}, markdownContent: content };
	}

	const markdownContent = match[2];

	let parsed: Record<string, unknown>;
	try {
		parsed = parseYaml(match[1]);
	} catch {
		return { metadata: {}, markdownContent: content };
	}

	const metadata: ContentMetadata = {};

	for (const key of [
		'title',
		'slug',
		'date',
		'published_at',
		'updated_at',
		'section',
		'primary_tag',
		'feature_image',
		'feature_image_alt',
		'excerpt',
		'meta_title',
		'meta_description',
		'og_title',
		'og_description',
		'og_image',
		'twitter_title',
		'twitter_description',
		'twitter_image',
		'author',
		'canonical_url',
		'codeinjection_head',
		'codeinjection_foot'
	]) {
		const value = asString(parsed, key);
		if (value !== undefined) {
			(metadata as Record<string, unknown>)[key] = value;
		}
	}

	if (!metadata.primary_tag) {
		const altPrimary = asString(parsed, 'primaryTag') ?? asString(parsed, 'primary-tag');
		if (altPrimary) {
			metadata.primary_tag = altPrimary;
		}
	}

	if (parsed.status !== undefined) {
		const statusValue = parsed.status;
		if (typeof statusValue === 'string') {
			const status = statusValue.toLowerCase();
			if (['draft', 'published', 'scheduled'].includes(status)) {
				metadata.status = status as PublishStatus;
			}
		}
	}

	if (parsed.type === 'page' || parsed.type === 'post') {
		metadata.type = parsed.type;
	}

	if (typeof parsed.featured === 'boolean') {
		metadata.featured = parsed.featured;
	}

	const tags = asStringArray(parsed, 'tags');
	if (tags !== undefined) {
		metadata.tags = tags;
	}

	const keywords = asStringArray(parsed, 'keywords');
	if (keywords !== undefined) {
		metadata.keywords = keywords;
	}

	return { metadata, markdownContent };
}

export function parseStringValue(value: string): string {
	return value.replace(/^['"]|['"]$/g, '');
}

export function parseBooleanValue(value: string): boolean {
	const clean = value.toLowerCase().trim();
	return clean === 'true' || clean === 'yes' || clean === '1';
}

export function parseArrayValue(value: string): string[] {
	if (value.startsWith('[') && value.endsWith(']')) {
		return value
			.slice(1, -1)
			.split(',')
			.map(item => item.trim().replace(/^['"]|['"]$/g, ''))
			.filter(Boolean);
	}

	const lines = value.split('\n');
	if (lines.length > 1) {
		return lines
			.map(line => line.trim())
			.filter(line => line.startsWith('- '))
			.map(line => line.substring(2).trim().replace(/^['"]|['"]$/g, ''))
			.filter(Boolean);
	}

	return value
		.split(',')
		.map(item => item.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
}
