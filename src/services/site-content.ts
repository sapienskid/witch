import type { ContentMetadata, PublishedContent, TagRegistry } from '../types/content';
import { generateSlug } from '../utils/slug';
import { internalTagName, isInternalTag } from '../utils/tags';
import { stringifyYaml } from '../utils/yaml';

export interface BuildParams {
	metadata: ContentMetadata;
	body: string;
	title: string;
	featureImageUrl?: string;
	registry?: TagRegistry;
}

export function resolveSection(metadata: ContentMetadata, routingTags: string[]): string | undefined {
	const routingSlugs = routingTags.map(generateSlug);
	const match = (metadata.tags ?? []).find(tag => !isInternalTag(tag) && routingSlugs.includes(generateSlug(tag)));
	return match !== undefined ? generateSlug(match) : undefined;
}

export function computeKey(metadata: ContentMetadata, fallbackTitle: string, routingTags: string[]): string {
	const title = metadata.title || fallbackTitle;
	const slug = metadata.slug || generateSlug(title);
	if (metadata.type === 'page') {
		return `${slug}/_index.md`;
	}
	const section = resolveSection(metadata, routingTags) ?? routingTags[0] ?? 'blog';
	return `${section}/${slug}.md`;
}

export function buildContent(params: BuildParams, routingTags: string[]): PublishedContent {
	const { metadata, body, title, featureImageUrl, registry } = params;
	const slug = metadata.slug || generateSlug(title);
	const section = resolveSection(metadata, routingTags);
	const sectionTag = section !== undefined ? generateSlug(section) : undefined;

	const allTags = metadata.tags ?? [];
	const publicTags = allTags.filter(tag => !isInternalTag(tag) && generateSlug(tag) !== sectionTag);
	const internalTags = allTags.filter(isInternalTag).map(internalTagName).filter(Boolean);
	const originalNames = new Map(publicTags.map(tag => [generateSlug(tag), tag]));
	const tagSlugs = publicTags.map(generateSlug);

	const publishedAt = metadata.published_at;
	const scheduled = publishedAt !== undefined && new Date(publishedAt).getTime() > Date.now();
	const draft = metadata.status === 'draft' || scheduled;

	const frontmatter: Record<string, unknown> = {
		title,
		date: metadata.date ?? publishedAt ?? new Date().toISOString().slice(0, 10),
		draft
	};

	if (metadata.updated_at) {
		frontmatter.lastmod = metadata.updated_at;
	}
	frontmatter.slug = slug;
	if (section) {
		frontmatter.section = section;
	}
	if (metadata.featured) {
		frontmatter.featured = true;
	}
	if (tagSlugs.length > 0) {
		frontmatter.tags = tagSlugs;
		frontmatter.primary_tag = tagSlugs[0];
		frontmatter.tag_names = tagSlugs.map(tag => {
			const entry = registry?.[tag];
			return entry?.name ?? originalNames.get(tag) ?? titleCase(tag);
		});
	}
	if (internalTags.length > 0) {
		frontmatter.internal_tags = internalTags;
	}
	if (featureImageUrl) {
		frontmatter.feature_image = featureImageUrl;
	}
	if (metadata.feature_image_alt) {
		frontmatter.feature_image_alt = metadata.feature_image_alt;
	}
	if (metadata.excerpt) {
		frontmatter.excerpt = metadata.excerpt;
	}
	frontmatter.reading_time = Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));

	if (metadata.author) {
		frontmatter.author = metadata.author;
	}

	if (metadata.canonical_url) {
		frontmatter.canonical_url = metadata.canonical_url;
	}
	for (const key of ['meta_title', 'meta_description', 'og_title', 'og_description', 'og_image', 'twitter_title', 'twitter_description', 'twitter_image', 'codeinjection_head', 'codeinjection_foot']) {
		const value = (metadata as Record<string, unknown>)[key];
		if (typeof value === 'string' && value.length > 0) {
			frontmatter[key] = value;
		}
	}
	if (metadata.keywords && metadata.keywords.length > 0) {
		frontmatter.keywords = metadata.keywords;
	}
	if (publishedAt) {
		frontmatter.published_at = publishedAt;
	}

	const content = `---\n${stringifyYaml(frontmatter)}---\n${body}`;
	return { key: computeKey(metadata, title, routingTags), content };
}

function titleCase(slug: string): string {
	return slug.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
