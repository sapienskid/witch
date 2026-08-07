import type { PublishStatus } from './settings';

export type SiteContentType = 'post' | 'page';
export type TagVisibility = 'public' | 'internal';

export interface ContentMetadata {
	title?: string;
	type?: SiteContentType;
	status?: PublishStatus;
	slug?: string;
	date?: string;
	published_at?: string;
	updated_at?: string;
	tags?: string[];
	featured?: boolean;
	feature_image?: string;
	feature_image_alt?: string;
	excerpt?: string;
	meta_title?: string;
	meta_description?: string;
	og_title?: string;
	og_description?: string;
	og_image?: string;
	twitter_title?: string;
	twitter_description?: string;
	twitter_image?: string;
	keywords?: string[];
	author?: string;
	canonical_url?: string;
	codeinjection_head?: string;
	codeinjection_foot?: string;
}

export interface PublishedContent {
	key: string;
	content: string;
}

export interface NavItem {
	label: string;
	url: string;
}

export interface NavGroup {
	name: string;
	links: NavItem[];
}

export interface SiteSettings {
	site?: {
		name?: string;
		title?: string;
		tagline?: string;
		description?: string;
		email?: string;
		location?: string;
		url?: string;
	};
	social?: Record<string, { url?: string; username?: string }>;
	homepage?: {
		heading?: string;
		subtitle?: string;
		sections?: Record<string, unknown>;
	};
	settings?: Record<string, unknown>;
	legal?: Record<string, string>;
	content?: Record<string, Record<string, unknown>>;
	pages?: Record<string, string>;
	seo?: {
		defaults?: Record<string, string>;
		content_types?: Record<string, string>;
		keywords?: string[];
	};
	nav?: {
		groups?: NavGroup[];
	};
	codeinjection?: {
		head?: string;
		foot?: string;
	};
	authoring?: {
		defaultStatus?: string;
		defaultAuthor?: string;
		defaultTags?: string;
	};
}

export interface TagEntry {
	name: string;
	slug: string;
	description?: string;
	accent_color?: string;
	feature_image?: string;
	parent?: string;
	visibility?: TagVisibility;
	canonical_url?: string;
	meta_title?: string;
	meta_description?: string;
	og_title?: string;
	og_description?: string;
	og_image?: string;
	twitter_title?: string;
	twitter_description?: string;
	twitter_image?: string;
}

export type TagRegistry = Record<string, TagEntry>;
