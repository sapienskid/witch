import type { WitchSettings } from '../types/settings';

export function publicMediaUrl(settings: WitchSettings, key: string): string {
	const domain = settings.r2CustomDomain.trim();
	if (domain) {
		return `https://${domain}/${key}`;
	}
	return `https://${settings.r2BucketName}.${settings.r2AccountId}.r2.dev/${key}`;
}
