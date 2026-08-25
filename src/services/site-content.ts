import type { ContentMetadata, PublishedContent, TagRegistry } from '../types/content';
import { generateSlug } from '../utils/slug';
import { internalTagName, isInternalTag } from '../utils/tags';
import { stringifyYaml } from '../utils/yaml';

export interface BuildParams {
	metadata: ContentMetadata;
	body: string;
	title: string;
	featureImageUrl?: string;
	ogImageUrl?: string;
	registry?: TagRegistry;
}

export function normalizeSectionSlug(slug: string): string {
	const normalized = generateSlug(slug);
	if (normalized === 'work') {
		return 'portfolio';
	}
	return normalized;
}

export function resolveSection(metadata: ContentMetadata, routingTags: string[]): string | undefined {
	if (metadata.section && metadata.section.trim().length > 0) {
		return normalizeSectionSlug(metadata.section.trim());
	}

	const routingSlugs = routingTags.map(generateSlug);
	if (metadata.primary_tag && metadata.primary_tag.trim().length > 0) {
		const primarySlug = generateSlug(metadata.primary_tag.trim());
		const normalized = normalizeSectionSlug(primarySlug);
		if (
			normalized === 'portfolio' ||
			normalized === 'blog' ||
			normalized === 'flashcards' ||
			routingSlugs.includes(primarySlug) ||
			routingSlugs.includes(normalized)
		) {
			return normalized;
		}
	}

	const allRoutingSlugs = new Set([...routingSlugs, 'work', 'portfolio', 'blog', 'flashcards']);
	for (const tag of metadata.tags ?? []) {
		if (isInternalTag(tag)) {
			continue;
		}
		const tagSlug = generateSlug(tag);
		if (allRoutingSlugs.has(tagSlug)) {
			return normalizeSectionSlug(tagSlug);
		}
	}

	return undefined;
}

export function computeKey(metadata: ContentMetadata, fallbackTitle: string, routingTags: string[]): string {
	const title = metadata.title || fallbackTitle;
	const slug = metadata.slug || generateSlug(title);
	if (metadata.type === 'page') {
		return `${slug}/_index.md`;
	}
	const section = resolveSection(metadata, routingTags) ?? normalizeSectionSlug(routingTags[0] ?? 'blog');
	return `${section}/${slug}.md`;
}

// Every content key that could correspond to a note, so unpublishing removes
// the note no matter where its slug/section/type currently points (or pointed
// when it was last published).
export function unpublishKeys(metadata: ContentMetadata, fallbackTitle: string, routingTags: string[], recordedKey?: string): string[] {
	const candidates = new Set<string>();
	if (recordedKey) {
		candidates.add(recordedKey);
	}
	const slug = metadata.slug || generateSlug(fallbackTitle);
	if (metadata.type === 'page') {
		candidates.add(`${slug}/_index.md`);
		return [...candidates];
	}
	const sections = [...routingTags, 'blog', 'portfolio', 'flashcards', 'work'].map(generateSlug);
	const uniqueSections = [...new Set(sections.filter(Boolean))];
	if (uniqueSections.length === 0) {
		uniqueSections.push('blog');
	}
	for (const section of uniqueSections) {
		candidates.add(`${section}/${slug}.md`);
	}
	return [...candidates];
}

export function buildContent(params: BuildParams, routingTags: string[]): PublishedContent {
	const { metadata, body, title, featureImageUrl, registry } = params;
	const slug = metadata.slug || generateSlug(title);
	const section = resolveSection(metadata, routingTags);
	const sectionRoutingSlugs = new Set<string>();
	if (section) {
		sectionRoutingSlugs.add(section);
		if (section === 'portfolio') {
			sectionRoutingSlugs.add('work');
			sectionRoutingSlugs.add('portfolio');
		}
	}

	const allTags = metadata.tags ?? [];
	const publicTags = allTags.filter(tag => !isInternalTag(tag) && !sectionRoutingSlugs.has(generateSlug(tag)));
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
	if (metadata.primary_tag) {
		frontmatter.primary_tag = generateSlug(metadata.primary_tag);
	} else if (tagSlugs.length > 0) {
		frontmatter.primary_tag = tagSlugs[0];
	} else if (section) {
		const usedWork = (metadata.tags ?? []).some(tag => generateSlug(tag) === 'work');
		frontmatter.primary_tag = usedWork ? 'work' : section;
	}
	if (tagSlugs.length > 0) {
		frontmatter.tags = tagSlugs;
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
	if (params.ogImageUrl && !metadata.og_image) {
		frontmatter.og_image = params.ogImageUrl;
		frontmatter.twitter_image = params.ogImageUrl;
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
