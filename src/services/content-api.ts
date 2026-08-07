import type { WitchSettings } from '../types/settings';

export interface ContentRequest {
	(url: string, method: string, headers: Record<string, string>, body?: string): Promise<{ status: number; text: string }>;
}

export interface MediaItem {
	key: string;
	size: number;
	uploaded: string;
}

export interface BuildStatus {
	lastBuildAt: string | null;
	lastBuildStatus: string | null;
	detail?: string;
}

export interface ContentApi {
	getManifest(): Promise<string[]>;
	getContent(key: string): Promise<string | null>;
	putContent(key: string, body: string): Promise<void>;
	deleteContent(key: string): Promise<void>;
	getImages(): Promise<MediaItem[]>;
	deleteImage(key: string): Promise<void>;
	getBuildStatus(): Promise<BuildStatus | null>;
	triggerBuild(): Promise<void>;
}

export class ContentApiClient implements ContentApi {
	constructor(
		private readonly settings: WitchSettings,
		private readonly request: ContentRequest
	) {}

	private baseUrl(): string {
		return this.settings.contentApiUrl.replace(/\/+$/, '');
	}

	private headers(hasBody: boolean): Record<string, string> {
		const headers: Record<string, string> = { Authorization: `Bearer ${this.settings.contentApiToken}` };
		if (hasBody) {
			headers['Content-Type'] = 'text/plain; charset=utf-8';
		}
		return headers;
	}

	private send(path: string, method: string, body?: string): Promise<{ status: number; text: string }> {
		const base = this.baseUrl();
		if (!base) {
			throw new Error('Content API URL is not configured');
		}
		return this.request(`${base}${path}`, method, this.headers(body !== undefined), body);
	}

	private assertOk(response: { status: number; text: string }, action: string): void {
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`${action} failed (HTTP ${response.status}): ${response.text}`);
		}
	}

	async getManifest(): Promise<string[]> {
		const response = await this.send('/api/manifest', 'GET');
		this.assertOk(response, 'Fetching content manifest');
		const data = JSON.parse(response.text) as { keys?: unknown };
		if (!Array.isArray(data.keys)) {
			return [];
		}
		return data.keys.map(String);
	}

	async getContent(key: string): Promise<string | null> {
		const response = await this.send(`/api/content/${encodeURIComponent(key)}`, 'GET');
		if (response.status === 404) {
			return null;
		}
		this.assertOk(response, 'Fetching content');
		return response.text;
	}

	async putContent(key: string, body: string): Promise<void> {
		const response = await this.send(`/api/content/${encodeURIComponent(key)}`, 'PUT', body);
		this.assertOk(response, 'Uploading content');
	}

	async deleteContent(key: string): Promise<void> {
		const response = await this.send(`/api/content/${encodeURIComponent(key)}`, 'DELETE');
		this.assertOk(response, 'Deleting content');
	}

	async getImages(): Promise<MediaItem[]> {
		const response = await this.send('/api/images', 'GET');
		this.assertOk(response, 'Fetching media');
		const data = JSON.parse(response.text) as { images?: unknown };
		if (!Array.isArray(data.images)) {
			return [];
		}
		return data.images.map(item => {
			const media = item as Partial<MediaItem>;
			return {
				key: String(media.key ?? ''),
				size: Number(media.size ?? 0),
				uploaded: String(media.uploaded ?? '')
			};
		});
	}

	async deleteImage(key: string): Promise<void> {
		const response = await this.send(`/api/images/${encodeURIComponent(key)}`, 'DELETE');
		this.assertOk(response, 'Deleting media');
	}

	async getBuildStatus(): Promise<BuildStatus | null> {
		const response = await this.send('/api/status', 'GET');
		if (response.status === 404) {
			return null;
		}
		this.assertOk(response, 'Fetching build status');
		const data = JSON.parse(response.text) as Partial<BuildStatus>;
		return {
			lastBuildAt: data.lastBuildAt ?? null,
			lastBuildStatus: data.lastBuildStatus ?? null,
			detail: data.detail ?? ''
		};
	}

	async triggerBuild(): Promise<void> {
		const response = await this.send('/api/build', 'POST');
		this.assertOk(response, 'Triggering build');
	}
}
