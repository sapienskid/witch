import type { TFile } from 'obsidian';

import type { GhostPost, PostMetadata } from '../types/ghost';
import type { WitchSettings, PublishStatus, PostVisibility } from '../types/settings';

export class PostBuilder {
    constructor(private readonly settings: WitchSettings) {}

    prepareGhostPost(file: TFile, metadata: PostMetadata, htmlContent: string, existingTags: Array<{ id: string; name: string; slug: string }> = []): GhostPost {
        const title = metadata.title || file.basename;
        if (!title.trim()) {
            throw new Error('Post title cannot be empty');
        }

        if (!htmlContent.trim()) {
            throw new Error('Post content cannot be empty');
        }

        const status: PublishStatus = metadata.status || this.settings.defaultStatus;
        const visibility: PostVisibility = metadata.visibility || 'public';

        const post: GhostPost = {
            title: title.trim(),
            html: htmlContent,
            status,
            slug: metadata.slug || this.generateSlug(title),
            featured: metadata.featured || false,
            visibility
        };

        this.assignOptionalFields(post, metadata);

        if (metadata.published_at?.trim()) {
            const date = new Date(metadata.published_at.trim());
            if (!Number.isNaN(date.getTime())) {
                post.published_at = metadata.published_at.trim();
            }
        }

        const tags = this.collectTagList(metadata.tags, this.settings.defaultTags, existingTags);
        post.tags = tags;

        const authors = this.getAuthorReferences();
        if (authors.length) {
            post.authors = authors;
        }

        return post;
    }

    generateSlug(input: string): string {
        return input
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    splitTagString(value?: string): string[] {
        if (!value) {
            return [];
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        const normalized = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
        return normalized
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
    }

    private assignOptionalFields(post: GhostPost, metadata: PostMetadata) {
        const optionalFields: Array<keyof PostMetadata> = [
            'excerpt',
            'feature_image',
            'meta_title',
            'meta_description',
            'og_title',
            'og_description',
            'og_image',
            'twitter_title',
            'twitter_description',
            'twitter_image',
            'custom_excerpt',
            'codeinjection_head',
            'codeinjection_foot'
        ];

        optionalFields.forEach(key => {
            const value = metadata[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                (post as any)[key] = value.trim();
            }
        });
    }

    private collectTagList(frontmatterTags?: string[], defaultTags?: string, existingTags: Array<{ id: string; name: string; slug: string }> = []): Array<{ name: string; slug?: string }> {
        const tags: Array<{ name: string; slug?: string }> = [];
        const seen = new Set<string>();

        const append = (value?: string) => {
            if (!value) {
                return;
            }
            const clean = value.trim();
            const lowercased = clean.toLowerCase();
            if (!clean || seen.has(lowercased)) {
                return;
            }
            seen.add(lowercased);

            // Try to find existing tag case-insensitively
            const existingTag = existingTags.find(tag => tag.name.toLowerCase() === lowercased);
            if (existingTag) {
                tags.push({ name: existingTag.name, slug: existingTag.slug });
            } else {
                tags.push({ name: clean, slug: this.generateSlug(clean) });
            }
        };

        frontmatterTags?.forEach(append);
        this.splitTagString(defaultTags).forEach(append);

        return tags;
    }

    private getAuthorReferences(): Array<string | { id?: string; slug?: string; email?: string }> {
        if (!this.settings.defaultAuthor) {
            return [];
        }

        const authors = this.settings.defaultAuthor
            .split(',')
            .map(author => author.trim())
            .filter(author => author.length > 0);

        return authors.map(author => {
            if (author.includes('@')) {
                return author;
            }
            return { slug: this.generateSlug(author) };
        });
    }
 }
