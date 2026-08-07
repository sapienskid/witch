import type { SiteSettings } from './content';

export type PublishStatus = 'draft' | 'published' | 'scheduled';
export type ImageFormat = 'webp' | 'jpeg' | 'png' | 'original';
export type Profile = 'dev' | 'prod';

export interface WitchSettings {
	contentApiUrl: string;
	contentApiToken: string;
	buildHookUrl: string;
	profile: Profile;
	siteFolder: string;
	sectionTags: string[];
	convertObsidianLinks: boolean;
	debugMode: boolean;
	site: SiteSettings;
	published: Record<string, string>;
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
	seo: { defaults: {}, content_types: {}, keywords: [] },
	nav: { groups: [] },
	codeinjection: {},
	authoring: {}
};

export const DEFAULT_SETTINGS: WitchSettings = {
	contentApiUrl: '',
	contentApiToken: '',
	buildHookUrl: '',
	profile: 'dev',
	siteFolder: 'Site',
	sectionTags: ['blog', 'portfolio', 'flashcards'],
	convertObsidianLinks: true,
	debugMode: false,
	site: DEFAULT_SITE,
	published: {},

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

export interface DevPreset {
	label: string;
	url: string;
	token: string;
	buildHookUrl: string;
}

export const PROFILE_PRESETS: Record<Profile, DevPreset> = {
	dev: {
		label: 'Local worker',
		url: 'http://localhost:8787',
		token: 'dev-token',
		buildHookUrl: '',
	},
	prod: {
		label: 'Production worker',
		url: '',
		token: '',
		buildHookUrl: '',
	},
};
