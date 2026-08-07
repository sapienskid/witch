import type { SiteSettings } from '../types/content';

export function siteJsonFor(site: SiteSettings): string {
	const clone: SiteSettings = { ...site };
	delete clone.authoring;
	return `${JSON.stringify(clone, null, 2)}\n`;
}
