export type PublishStatus = 'draft' | 'published' | 'scheduled';
export type PostVisibility = 'public' | 'members' | 'paid';



export interface WitchSettings {
	ghostSiteUrl: string;
	adminApiKey: string;
	defaultStatus: PublishStatus;
	convertObsidianLinks: boolean;
	addSourceLink: boolean;
	debugMode: boolean;
	defaultAuthor: string;
	defaultTags: string;
	r2AccountId: string;
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
	r2BucketName: string;
	r2CustomDomain: string;
	enableR2Upload: boolean;
	r2ImagePath: string;
}

export const DEFAULT_SETTINGS: WitchSettings = {
	ghostSiteUrl: '',
	adminApiKey: '',
	defaultStatus: 'draft',
	convertObsidianLinks: true,
	addSourceLink: false,
	debugMode: false,
	defaultAuthor: '',
	defaultTags: '',

	r2AccountId: '',
	r2AccessKeyId: '',
	r2SecretAccessKey: '',
	r2BucketName: '',
	r2CustomDomain: '',
	enableR2Upload: false,
	r2ImagePath: 'images'
};
