import { OG_IMAGE_FONT_FAMILY, OG_IMAGE_FORMAT, OG_IMAGE_HEIGHT, OG_IMAGE_QUALITY, OG_IMAGE_WIDTH, computeOgLayout, type OgCardData, type TextMeasure } from './og-card';

export interface OgCanvas {
	width: number;
	height: number;
	getContext(kind: '2d'): OgCanvasContext | null;
	convertToBlob?(options: { type: string; quality?: number }): Promise<Blob>;
	toBlob?(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

export interface OgCanvasContext {
	fillStyle: string | CanvasGradient | CanvasPattern;
	strokeStyle: string | CanvasGradient | CanvasPattern;
	font: string;
	lineWidth: number;
	textAlign: string;
	textBaseline: string;
	fillRect(x: number, y: number, width: number, height: number): void;
	fillText(text: string, x: number, y: number): void;
	beginPath(): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	stroke(): void;
	arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
	fill(): void;
	measureText(text: string): { width: number };
}

export type CanvasFactory = (width: number, height: number) => { canvas: OgCanvas; ctx: OgCanvasContext };

export const createCanvas2D: CanvasFactory = (width, height) => {
	if (typeof OffscreenCanvas !== 'undefined') {
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('2D context unavailable');
		}
		return { canvas, ctx };
	}
	const canvas = createEl('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('2D context unavailable');
	}
	return { canvas, ctx };
};

async function canvasToWebP(canvas: OgCanvas, quality: number): Promise<Blob> {
	if (canvas.convertToBlob) {
		return canvas.convertToBlob({ type: 'image/webp', quality });
	}
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob?.(blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/webp', quality);
	});
}

export async function renderOgCard(
	data: OgCardData,
	measure?: TextMeasure,
	factory: CanvasFactory = createCanvas2D
): Promise<Uint8Array<ArrayBufferLike>> {
	const { canvas, ctx } = factory(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
	const measureText: TextMeasure =
		measure ??
		((text, size, weight) => {
			ctx.font = `${weight} ${size}px ${OG_IMAGE_FONT_FAMILY}`;
			return ctx.measureText(text).width;
		});

	const layout = computeOgLayout(data, measureText);
	const accent = data.accentColor || '#111111';
	const margin = 80;

	// Background + accent bar
	ctx.fillStyle = '#fdfdfb';
	ctx.fillRect(0, 0, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
	ctx.fillStyle = accent;
	ctx.fillRect(0, 0, 20, OG_IMAGE_HEIGHT);

	// Brand row: accent square + site name
	ctx.fillStyle = accent;
	ctx.fillRect(margin, 92, 16, 16);
	ctx.fillStyle = '#141414';
	ctx.font = `600 28px ${OG_IMAGE_FONT_FAMILY}`;
	ctx.fillText(layout.siteName.toUpperCase(), margin + 30, 108);

	// Rule
	ctx.strokeStyle = '#e8e5dd';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(margin, 148);
	ctx.lineTo(OG_IMAGE_WIDTH - margin, 148);
	ctx.stroke();

	// Title
	ctx.fillStyle = '#141414';
	let titleY = 250;
	const titleBlockHeight = layout.titleLines.reduce((height, line) => height + line.size * 1.16, 0);
	for (const line of layout.titleLines) {
		ctx.font = `700 ${line.size}px ${OG_IMAGE_FONT_FAMILY}`;
		ctx.fillText(line.text, margin, titleY);
		titleY += line.size * 1.16;
	}

	// Excerpt
	if (layout.excerptLines.length > 0) {
		ctx.fillStyle = '#56534e';
		ctx.font = `400 30px ${OG_IMAGE_FONT_FAMILY}`;
		let excerptY = 250 + titleBlockHeight + 40;
		for (const line of layout.excerptLines) {
			ctx.fillText(line, margin, excerptY);
			excerptY += 42;
		}
	}

	// Bottom row: section chip + date
	const bottomY = 552;
	const chip = (layout.sectionLabel || 'POST').toUpperCase();
	ctx.font = `600 26px ${OG_IMAGE_FONT_FAMILY}`;
	const chipWidth = measureText(chip, 26, 600);
	ctx.fillStyle = accent;
	ctx.fillText(chip, margin, bottomY);
	if (layout.dateLabel) {
		ctx.fillStyle = '#9a978f';
		ctx.font = `400 26px ${OG_IMAGE_FONT_FAMILY}`;
		ctx.fillText(layout.dateLabel, margin + chipWidth + 24, bottomY);
	}

	// Monogram badge
	const badgeX = OG_IMAGE_WIDTH - 120;
	const badgeY = bottomY - 16;
	ctx.fillStyle = accent;
	ctx.beginPath();
	ctx.arc(badgeX, badgeY, 42, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.font = `700 34px ${OG_IMAGE_FONT_FAMILY}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(layout.monogram, badgeX, badgeY + 2);
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	const blob = await canvasToWebP(canvas, OG_IMAGE_QUALITY);
	return new Uint8Array(await blob.arrayBuffer());
}

export type { OgCardData, TextMeasure } from './og-card';
export { ogCardDataFor, ogImageKey, pickAccentColor } from './og-card';
export const ogImageFormat = OG_IMAGE_FORMAT;
