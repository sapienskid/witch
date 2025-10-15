import { requestUrl, Notice, type RequestUrlParam } from 'obsidian';

import type { GhostPost } from '../types/ghost';
import type { WitchSettings } from '../types/settings';
import { generateGhostAdminToken } from '../utils/jwt';

export class GhostApiClient {
    constructor(private readonly settings: WitchSettings) {}

    async findExistingPost(slugOrTitle: string): Promise<GhostPost | null> {
        try {
            const jwt = await this.generateJWT();
            const params: RequestUrlParam = {
                url: `${this.settings.ghostSiteUrl}/ghost/api/admin/posts/?filter=slug:${slugOrTitle}`,
                method: 'GET',
                headers: {
                    Authorization: `Ghost ${jwt}`,
                    'Content-Type': 'application/json',
                    'Accept-Version': 'v6.0'  // Adjust to 'v5.0' if on Ghost 5.x (check Admin > Settings > About)
                }
            };

            const response = await requestUrl(params);

            if (this.settings.debugMode) {
                console.log('Raw Ghost API response (findExistingPost):', {
                    status: response.status,
                    fullText: response.text
                });
            }

            if (response.status < 200 || response.status >= 300) {
                let message = 'Unknown error';
                try {
                    const errorData = JSON.parse(response.text);
                    message = errorData.errors?.map((e: any) => e.message).join(', ') || message;
                } catch {
                    message = response.text || 'No response body';
                }
                console.warn(`Ghost API returned status ${response.status}: ${message}`);
                return null;
            }

            try {
                const data = JSON.parse(response.text);
                if (data?.posts?.length) {
                    return data.posts[0];
                }
            } catch (e) {
                if (this.settings.debugMode) {
                    console.warn('Failed to parse Ghost API response in findExistingPost:', e);
                }
            }

            return null;
        } catch (error) {
            if (this.settings.debugMode) {
                console.warn('Post not found or Ghost API lookup failed:', error);
            }
            return null;
        }
    }

    async createGhostPost(post: GhostPost): Promise<any> {
        const jwt = await this.generateJWT();
        const cleanPost = this.cleanPostData(post);

        // Optional: Validate authors before sending (uncomment if needed)
        if (cleanPost.authors?.length) {
            // Only pass objects with slug or id, not strings
            const authorObjs = cleanPost.authors
                .filter(a => typeof a === 'object' && (a.slug || a.id))
                .map(a => ({ slug: (a as any).slug, id: (a as any).id }));
            const valid = await this.validateAuthors(authorObjs);
            if (!valid) {
                throw new Error('Invalid authors provided; check console for details.');
            }
        }

        if (this.settings.debugMode) {
            console.log('Creating Ghost post with data:', JSON.stringify(cleanPost, null, 2));
        }

        const params: RequestUrlParam = {
            url: `${this.settings.ghostSiteUrl}/ghost/api/admin/posts/?source=html`,
            method: 'POST',
            headers: {
                Authorization: `Ghost ${jwt}`,
                'Content-Type': 'application/json',
                'Accept-Version': 'v6.0'
            },
            body: JSON.stringify({ posts: [cleanPost] })
        };

        try {
            const response = await requestUrl(params);

            if (this.settings.debugMode) {
                console.log('Raw Ghost API response (createGhostPost):', {
                    status: response.status,
                    fullText: response.text
                });
            }

            if (response.status < 200 || response.status >= 300) {
                if (this.settings.debugMode) {
                    console.log('Ghost API error response body:', response.text);  // New: Log raw error body
                }
                let message = 'Unknown error';
                try {
                    const errorData = JSON.parse(response.text);
                    message = errorData.errors?.map((e: any) => e.message).join(', ') || message;
                } catch (parseError) {
                    message = response.text || 'No response body';
                    if (this.settings.debugMode) {
                        console.warn('Failed to parse error response:', parseError);
                    }
                }
                throw new Error(`Ghost API returned status ${response.status}: ${message}`);
            }

            return JSON.parse(response.text);
        } catch (error) {
            this.handleApiError('create', error, cleanPost);
            throw error;
        }
    }

    async updateGhostPost(postId: string, post: GhostPost): Promise<any> {
        const jwt = await this.generateJWT();
        const cleanPost = this.cleanPostData(post);

        if (this.settings.debugMode) {
            console.log('Updating Ghost post with data:', JSON.stringify(cleanPost, null, 2));
        }

        const params: RequestUrlParam = {
            url: `${this.settings.ghostSiteUrl}/ghost/api/admin/posts/${postId}/?source=html`,
            method: 'PUT',
            headers: {
                Authorization: `Ghost ${jwt}`,
                'Content-Type': 'application/json',
                'Accept-Version': 'v6.0'
            },
            body: JSON.stringify({ posts: [cleanPost] })
        };

        try {
            const response = await requestUrl(params);

            if (this.settings.debugMode) {
                console.log('Raw Ghost API response (updateGhostPost):', {
                    status: response.status,
                    fullText: response.text
                });
            }

            if (response.status < 200 || response.status >= 300) {
                if (this.settings.debugMode) {
                    console.log('Ghost API error response body:', response.text);  // New: Log raw error body
                }
                let message = 'Unknown error';
                try {
                    const errorData = JSON.parse(response.text);
                    message = errorData.errors?.map((e: any) => e.message).join(', ') || message;
                } catch (parseError) {
                    message = response.text || 'No response body';
                    if (this.settings.debugMode) {
                        console.warn('Failed to parse error response:', parseError);
                    }
                }
                throw new Error(`Ghost API returned status ${response.status}: ${message}`);
            }

            return JSON.parse(response.text);
        } catch (error) {
            this.handleApiError('update', error, cleanPost);
            throw error;
        }
    }

    // New: Optional method to validate authors against existing site users
    async validateAuthors(authors: { slug?: string; id?: string }[]): Promise<boolean> {
        try {
            const jwt = await this.generateJWT();
            const params: RequestUrlParam = {
                url: `${this.settings.ghostSiteUrl}/ghost/api/admin/users/?limit=all`,
                method: 'GET',
                headers: {
                    Authorization: `Ghost ${jwt}`,
                    'Content-Type': 'application/json',
                    'Accept-Version': 'v6.0'
                }
            };

            const response = await requestUrl(params);
            if (response.status !== 200) {
                return false;
            }

            const data = JSON.parse(response.text);
            const existingSlugs = data.users.map((u: any) => u.slug);
            const existingIds = data.users.map((u: any) => u.id);

            for (const author of authors) {
                if (author.slug && !existingSlugs.includes(author.slug)) {
                    console.warn(`Author slug "${author.slug}" not found on Ghost site.`);
                    return false;
                }
                if (author.id && !existingIds.includes(author.id)) {
                    console.warn(`Author ID "${author.id}" not found on Ghost site.`);
                    return false;
                }
            }
            return true;
        } catch (error) {
            if (this.settings.debugMode) {
                console.warn('Failed to validate authors:', error);
            }
            return false;
        }
    }

    async generateJWT(): Promise<string> {
        return generateGhostAdminToken(this.settings.adminApiKey);
    }

    async getDetailedError(error: any): Promise<string> {
        if (error?.response?.text) {
            try {
                const data = JSON.parse(error.response.text);
                if (Array.isArray(data.errors) && data.errors.length) {
                    return data.errors.map((entry: any) => entry.message ?? entry.type).join(', ');
                }
            } catch {
                return error.response.text;
            }
        }

        return error?.message ?? 'Unknown validation error';
    }

    private cleanPostData(post: GhostPost): GhostPost {
        const clean: Record<string, unknown> = {};
        Object.entries(post).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }

            if (Array.isArray(value) && value.length === 0) {
                return;
            }

            clean[key] = value;
        });

        if (!clean.title) {
            throw new Error('Post title is required');
        }

        if (!clean.html && !clean.mobiledoc) {
            throw new Error('Post content (html or mobiledoc) is required');
        }

        if (clean.html && typeof clean.html === 'string') {
            if (!/<[^>]+>/.test(clean.html)) {
                throw new Error('HTML content appears invalid or empty');
            }
        }

        if (!clean.status || !['draft', 'published', 'scheduled'].includes(String(clean.status))) {
            clean.status = 'draft';
        }

        if (clean.visibility && !['public', 'members', 'paid', 'tiers'].includes(String(clean.visibility))) {
            clean.visibility = 'public';
        }

        // New: Auto-format date fields to full ISO 8601
        const dateFields = ['published_at', 'updated_at', 'created_at'];
        const yyyyMmDd = /^\d{4}-\d{2}-\d{2}$/;

        dateFields.forEach(field => {
            if (clean[field] && typeof clean[field] === 'string') {
                let dateString = clean[field] as string;

                // If date is in YYYY-MM-DD format, append time to make it a valid ISO string
                if (yyyyMmDd.test(dateString)) {
                    dateString += 'T00:00:00.000Z'; 
                }

                const date = new Date(dateString);

                if (!isNaN(date.getTime())) {
                    clean[field] = date.toISOString();
                } else {
                    console.warn(`Invalid date format for ${field}: "${clean[field]}". Omitting field.`);
                    delete clean[field];
                }
            }
        });

        // Warn if authors provided (common error source)
        if (this.settings.debugMode && clean.authors) {
            console.log('Authors provided; ensure slugs/IDs exist on Ghost site:', clean.authors);
        }

        return clean as unknown as GhostPost;
    }

    private async handleApiError(action: 'create' | 'update', error: any, payload: unknown) {
        if (this.settings.debugMode) {
            console.error(`Ghost API ${action} error details:`, {
                status: error?.status,
                message: error?.message,
                payload
            });
            console.error('Full error object:', error);
        }
        if (String(error?.message).includes('422')) {
            const detailed = await this.getDetailedError(error);
            new Notice(`Ghost validation error (422): ${detailed || 'Check console for details (likely invalid date or author).'}`);
        }
    }
}