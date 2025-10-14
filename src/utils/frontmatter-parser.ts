import type { PostMetadata } from '../types/ghost';
import type { PostVisibility, PublishStatus } from '../types/settings';

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

export function parseFrontmatter(content: string): { metadata: PostMetadata; markdownContent: string } {
	const match = content.match(FRONTMATTER_REGEX);

	if (!match) {
		return {
			metadata: {},
			markdownContent: content
		};
	}

	const frontmatterText = match[1];
	const markdownContent = match[2];

	const metadata: PostMetadata = {};
	const lines = frontmatterText.split('\n');

	for (const rawLine of lines) {
		const colonIndex = rawLine.indexOf(':');
		if (colonIndex === -1) {
			continue;
		}

		const key = rawLine.substring(0, colonIndex).trim();
		const value = rawLine.substring(colonIndex + 1).trim();

		if (!value) {
			continue;
		}

		switch (key) {
			case 'title':
			case 'slug':
			case 'excerpt':
			case 'meta_title':
			case 'meta_description':
			case 'og_title':
			case 'og_description':
			case 'og_image':
			case 'twitter_title':
			case 'twitter_description':
			case 'twitter_image':
			case 'feature_image':
			case 'custom_excerpt':
			case 'codeinjection_head':
			case 'codeinjection_foot':
				metadata[key] = parseStringValue(value);
				break;
			case 'status':
				if (['draft', 'published', 'scheduled'].includes(value)) {
					metadata.status = value as PublishStatus;
				}
				break;
			case 'visibility':
				if (['public', 'members', 'paid'].includes(value)) {
					metadata.visibility = value as PostVisibility;
				}
				break;
			case 'featured':
				metadata.featured = parseBooleanValue(value);
				break;
			case 'tags':
				metadata.tags = parseArrayValue(value);
				break;
			case 'published_at':
				metadata.published_at = parseStringValue(value);
				break;
		}
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

	return value
		.split(',')
		.map(item => item.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
}
