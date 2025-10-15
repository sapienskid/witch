import * as yaml from 'js-yaml';
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

	let parsed: any;
	try {
		parsed = yaml.load(frontmatterText) || {};
	} catch (error) {
		console.warn('Failed to parse frontmatter as YAML:', error);
		return {
			metadata: {},
			markdownContent: content
		};
	}

	const metadata: PostMetadata = {};

	// Map YAML keys to metadata
	if (parsed.title) metadata.title = String(parsed.title);
	if (parsed.slug) metadata.slug = String(parsed.slug);
	if (parsed.excerpt) metadata.excerpt = String(parsed.excerpt);
	if (parsed.meta_title) metadata.meta_title = String(parsed.meta_title);
	if (parsed.meta_description) metadata.meta_description = String(parsed.meta_description);
	if (parsed.og_title) metadata.og_title = String(parsed.og_title);
	if (parsed.og_description) metadata.og_description = String(parsed.og_description);
	if (parsed.og_image) metadata.og_image = String(parsed.og_image);
	if (parsed.twitter_title) metadata.twitter_title = String(parsed.twitter_title);
	if (parsed.twitter_description) metadata.twitter_description = String(parsed.twitter_description);
	if (parsed.twitter_image) metadata.twitter_image = String(parsed.twitter_image);
	if (parsed.feature_image) metadata.feature_image = String(parsed.feature_image);
	if (parsed.custom_excerpt) metadata.custom_excerpt = String(parsed.custom_excerpt);
	if (parsed.codeinjection_head) metadata.codeinjection_head = String(parsed.codeinjection_head);
	if (parsed.codeinjection_foot) metadata.codeinjection_foot = String(parsed.codeinjection_foot);

	if (parsed.status && ['draft', 'published', 'scheduled'].includes(parsed.status)) {
		metadata.status = parsed.status as PublishStatus;
	}
	if (parsed.visibility && ['public', 'members', 'paid'].includes(parsed.visibility)) {
		metadata.visibility = parsed.visibility as PostVisibility;
	}
	if (typeof parsed.featured === 'boolean') {
		metadata.featured = parsed.featured;
	}
	if (parsed.tags) {
		if (Array.isArray(parsed.tags)) {
			metadata.tags = parsed.tags.map(String);
		} else if (typeof parsed.tags === 'string') {
			metadata.tags = [String(parsed.tags)];
		}
	}
	if (parsed.published_at) metadata.published_at = String(parsed.published_at);

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

	// Handle YAML list format (multi-line)
	const lines = value.split('\n');
	if (lines.length > 1) {
		return lines
			.map(line => line.trim())
			.filter(line => line.startsWith('- '))
			.map(line => line.substring(2).trim().replace(/^['"]|['"]$/g, ''))
			.filter(Boolean);
	}

	// Handle comma-separated without brackets
	return value
		.split(',')
		.map(item => item.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
}
