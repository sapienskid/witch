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
					'Content-Type': 'application/json'
				}
			};

			const response = await requestUrl(params);
			if (response.json?.posts?.length) {
				return response.json.posts[0];
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

		if (this.settings.debugMode) {
			console.log('Creating Ghost post with data:', JSON.stringify(cleanPost, null, 2));
		}

		const params: RequestUrlParam = {
			url: `${this.settings.ghostSiteUrl}/ghost/api/admin/posts/?source=html`,
			method: 'POST',
			headers: {
				Authorization: `Ghost ${jwt}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ posts: [cleanPost] })
		};

		try {
			const response = await requestUrl(params);
			return response.json;
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
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ posts: [cleanPost] })
		};

		try {
			const response = await requestUrl(params);
			return response.json;
		} catch (error) {
			this.handleApiError('update', error, cleanPost);
			throw error;
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

		if (!clean.status || !['draft', 'published', 'scheduled'].includes(String(clean.status))) {
			clean.status = 'draft';
		}

		if (clean.visibility && !['public', 'members', 'paid'].includes(String(clean.visibility))) {
			clean.visibility = 'public';
		}

	return clean as unknown as GhostPost;
	}

	private handleApiError(action: 'create' | 'update', error: any, payload: unknown) {
		if (this.settings.debugMode) {
			console.error(`Ghost API ${action} error details:`, {
				status: error?.status,
				message: error?.message,
				payload
			});
		}
		if (error?.message?.includes('422')) {
			new Notice('Ghost validation error (422). Check console for details.');
		}
	}
}
