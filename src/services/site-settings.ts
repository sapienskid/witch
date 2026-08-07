import type WitchPlugin from '../../main';
import type { SiteSettings } from '../types/content';
import { DEFAULT_SITE } from '../types/settings';
import { siteJsonFor } from './site-json';

export class SiteSettingsService {
	constructor(private readonly plugin: WitchPlugin) {}

	async get(): Promise<SiteSettings> {
		return this.plugin.settings.site ?? this.getDefaults();
	}

	async save(site: SiteSettings): Promise<void> {
		this.plugin.settings.site = site;
		await this.plugin.saveSettings();
	}

	serialize(site: SiteSettings): string {
		return siteJsonFor(site);
	}

	getDefaults(): SiteSettings {
		return { ...DEFAULT_SITE };
	}
}
