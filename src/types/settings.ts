import type { SiteSettings } from './content';

export type PublishStatus = 'draft' | 'published' | 'scheduled';
export type ImageFormat = 'webp' | 'jpeg' | 'png' | 'original';

export interface WitchSettings {
	contentApiUrl: string;
	contentApiToken: string;
	siteFolder: string;
	sectionTags: string[];
	convertObsidianLinks: boolean;
	debugMode: boolean;
	enableOgCards: boolean;
	site: SiteSettings;
	published: Record<string, string>;
	publishedKeys: Record<string, string>;
	r2AccountId: string;
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
	r2BucketName: string;
	r2CustomDomain: string;
	enableR2Upload: boolean;
	r2ImagePath: string;
	enableImageOptimization: boolean;
	imageFormat: ImageFormat;
	imageQuality: number;
	maxImageWidth: number;
	maxImageHeight: number;
}

export const DEFAULT_SITE: SiteSettings = {
	site: {
		name: '',
		title: '',
		tagline: '',
		description: '',
		email: '',
		location: ''
	},
	social: {},
	homepage: {},
	settings: {},
	legal: {},
	content: {},
	pages: {},
	seo: { defaults: {}, content_types: {}, keywords: {} },
	nav: { groups: [] },
	codeinjection: {},
	authoring: {}
};

export const DEFAULT_SETTINGS: WitchSettings = {
	contentApiUrl: '',
	contentApiToken: '',
	siteFolder: 'Site',
	sectionTags: ['blog', 'work', 'portfolio', 'flashcards'],
	convertObsidianLinks: true,
	debugMode: false,
	enableOgCards: true,
	site: DEFAULT_SITE,
	published: {},
	publishedKeys: {},

	r2AccountId: '',
	r2AccessKeyId: '',
	r2SecretAccessKey: '',
	r2BucketName: '',
	r2CustomDomain: '',
	enableR2Upload: false,
	r2ImagePath: 'images',

	enableImageOptimization: true,
	imageFormat: 'webp',
	imageQuality: 80,
	maxImageWidth: 1920,
	maxImageHeight: 0,
};
