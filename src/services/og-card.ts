import type { TagRegistry } from '../types/content';
import { generateSlug } from '../utils/slug';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_FORMAT = 'webp';
export const OG_IMAGE_QUALITY = 0.9;
export const OG_IMAGE_MAX_TITLE_LINES = 3;
export const OG_IMAGE_MAX_EXCERPT_LINES = 2;
export const OG_IMAGE_FONT_FAMILY = 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const DEFAULT_ACCENT = '#111111';

export interface TextMeasure {
	(text: string, fontSize: number, fontWeight: number): number;
}

export interface OgCardData {
	siteName: string;
	title: string;
	excerpt?: string;
	accentColor: string;
	sectionLabel?: string;
	dateLabel?: string;
	monogram: string;
}

export interface OgCardContext {
	siteName: string;
	title: string;
	body: string;
	excerpt?: string;
	tags?: string[];
	registry?: TagRegistry;
	section?: string;
	date?: string;
	accentFallback?: string;
}

export interface WrappedText {
	lines: string[];
	truncated: boolean;
}

export interface OgLayout {
	siteName: string;
	titleLines: { text: string; size: number }[];
	excerptLines: string[];
	sectionLabel?: string;
	dateLabel?: string;
	monogram: string;
}

export function ogImageKey(slug: string): string {
	return `og/${slug}.webp`;
}

export function pickAccentColor(registry: TagRegistry | undefined, tags: string[] | undefined, fallback: string): string {
	if (!registry || !tags) {
		return fallback;
	}
	for (const tag of tags) {
		const entry = registry[tag] ?? registry[generateSlug(tag)];
		const color = entry?.accent_color?.trim();
		if (color) {
			return color;
		}
	}
	return fallback;
}

export function monogramFor(siteName: string): string {
	const parts = siteName.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return 'S';
	}
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function formatDateLabel(date?: string): string | undefined {
	if (!date) {
		return undefined;
	}
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) {
		return undefined;
	}
	return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function plainify(text: string): string {
	return text
		.replace(/^---[\s\S]*?---\s*/m, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/^#{1,6}\s+.*$/gm, '')
		.replace(/[*_`~>|]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function ogCardDataFor(ctx: OgCardContext): OgCardData {
	const fallbackExcerpt = plainify(ctx.body).slice(0, 180);
	const excerpt = ctx.excerpt?.trim() || (ctx.body.trim() ? fallbackExcerpt : undefined);
	return {
		siteName: ctx.siteName || 'Witch',
		title: ctx.title,
		excerpt: excerpt || undefined,
		accentColor: pickAccentColor(ctx.registry, ctx.tags, ctx.accentFallback ?? DEFAULT_ACCENT),
		sectionLabel: ctx.section ? ctx.section.toUpperCase() : undefined,
		dateLabel: formatDateLabel(ctx.date),
		monogram: monogramFor(ctx.siteName)
	};
}

export function wrapText(
	text: string,
	maxWidth: number,
	fontSize: number,
	fontWeight: number,
	measure: TextMeasure,
	maxLines: number
): WrappedText {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (current && measure(candidate, fontSize, fontWeight) > maxWidth) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) {
		lines.push(current);
	}

	const truncated = lines.length > maxLines;
	const result = lines.slice(0, maxLines);
	if (truncated && result.length > 0) {
		let last = result[result.length - 1];
		while (last.length > 1 && measure(`${last}…`, fontSize, fontWeight) > maxWidth) {
			last = last.slice(0, -1);
		}
		result[result.length - 1] = `${last.trimEnd()}…`;
	}
	return { lines: result, truncated };
}

export function computeOgLayout(data: OgCardData, measure: TextMeasure): OgLayout {
	const maxWidth = OG_IMAGE_WIDTH - 160;
	let titleSize = 72;
	let wrapped = wrapText(data.title, maxWidth, titleSize, 700, measure, OG_IMAGE_MAX_TITLE_LINES);
	if (wrapped.truncated) {
		titleSize = 58;
		wrapped = wrapText(data.title, maxWidth, titleSize, 700, measure, OG_IMAGE_MAX_TITLE_LINES);
	}
	if (wrapped.truncated) {
		titleSize = 50;
		wrapped = wrapText(data.title, maxWidth, titleSize, 700, measure, OG_IMAGE_MAX_TITLE_LINES);
	}

	return {
		siteName: data.siteName || 'Witch',
		titleLines: wrapped.lines.map(text => ({ text, size: titleSize })),
		excerptLines: data.excerpt
			? wrapText(data.excerpt, maxWidth, 30, 400, measure, OG_IMAGE_MAX_EXCERPT_LINES).lines
			: [],
		sectionLabel: data.sectionLabel,
		dateLabel: data.dateLabel,
		monogram: data.monogram || 'SP'
	};
}
