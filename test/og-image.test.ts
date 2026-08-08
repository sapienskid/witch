import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { OgCanvas, OgCanvasContext } from '../src/services/og-image';

class MockCtx implements OgCanvasContext {
	fillStyle = '';
	strokeStyle = '';
	font = '';
	lineWidth = 1;
	textAlign = 'left';
	textBaseline = 'alphabetic';
	fillRect(): void {}
	fillText(): void {}
	beginPath(): void {}
	moveTo(): void {}
	lineTo(): void {}
	stroke(): void {}
	arc(): void {}
	fill(): void {}
	measureText(text: string): { width: number } {
		return { width: text.length * 10 };
	}
}

class MockCanvas implements OgCanvas {
	readonly width: number;
	readonly height: number;
	private readonly mockCtx = new MockCtx();
	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
	}
	getContext(): OgCanvasContext {
		return this.mockCtx;
	}
	convertToBlob(options: { type: string }): Promise<Blob> {
		return Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: options.type }));
	}
}

test('renderOgCard draws the card and returns a webp buffer', async () => {
	const { renderOgCard } = await import('../src/services/og-image');
	const buffer = await renderOgCard(
		{
			siteName: 'Sabin Pokharel',
			title: 'A Real Post Title',
			excerpt: 'Some excerpt text for the card.',
			accentColor: '#ae3ec9',
			sectionLabel: 'BLOG',
			dateLabel: 'Aug 8, 2026',
			monogram: 'SP'
		},
		(text, size, _weight) => text.length * size * 0.55,
		(width, height) => {
			const canvas = new MockCanvas(width, height);
			const ctx = canvas.getContext();
			return { canvas, ctx };
		}
	);
	assert.ok(buffer instanceof Uint8Array);
	assert.ok(buffer.length > 0);
});
