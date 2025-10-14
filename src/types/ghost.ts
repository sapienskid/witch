import type { PublishStatus, PostVisibility } from './settings';

export interface PostMetadata {
    title?: string;
    status?: PublishStatus;
    tags?: string[];
    featured?: boolean;
    feature_image?: string;
    excerpt?: string;
    published_at?: string;
    slug?: string;
    meta_title?: string;
    meta_description?: string;
    og_image?: string;
    og_title?: string;
    og_description?: string;
    twitter_image?: string;
    twitter_title?: string;
    twitter_description?: string;
    custom_excerpt?: string;
    codeinjection_head?: string;
    codeinjection_foot?: string;
    visibility?: PostVisibility;
}

export interface GhostPost {
    id?: string;
    title: string;
    slug?: string;
    html?: string;
    mobiledoc?: string;
    status: PublishStatus;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    tags?: Array<{ name: string; slug?: string }>;
    authors?: Array<string | { id?: string; slug?: string; email?: string }>;
    featured?: boolean;
    feature_image?: string;
    excerpt?: string;
    meta_title?: string;
    meta_description?: string;
    og_image?: string;
    og_title?: string;
    og_description?: string;
    twitter_image?: string;
    twitter_title?: string;
    twitter_description?: string;
    custom_excerpt?: string;
    codeinjection_head?: string;
    codeinjection_foot?: string;
    visibility?: PostVisibility;
    newsletter?: { id: string };
    email_only?: boolean;
    email_recipient_filter?: string;
}
