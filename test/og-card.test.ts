import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	computeOgLayout,
	formatDateLabel,
	monogramFor,
	ogCardDataFor,
	ogImageKey,
	pickAccentColor,
	plainify,
	wrapText
} from '../src/services/og-card';

const charWidth: (text: string, size: number, weight: number) => number = (text, size, _weight) => text.length * size * 0.55;

test('ogImageKey prefixes the og folder and appends webp', () => {
	assert.equal(ogImageKey('my-post'), 'og/my-post.webp');
});

test('pickAccentColor uses the first matching tag accent', () => {
	const registry = { ai: { name: 'AI', slug: 'ai', accent_color: '#ae3ec9' } };
	assert.equal(pickAccentColor(registry, ['ai'], '#111111'), '#ae3ec9');
	assert.equal(pickAccentColor(registry, ['unknown'], '#111111'), '#111111');
	assert.equal(pickAccentColor(undefined, undefined, '#111111'), '#111111');
});

test('monogramFor builds initials from the site name', () => {
	assert.equal(monogramFor('Sabin Pokharel'), 'SP');
	assert.equal(monogramFor('Sabin'), 'SA');
	assert.equal(monogramFor(''), 'S');
});

test('formatDateLabel renders a readable date', () => {
	assert.equal(formatDateLabel('2026-08-08'), 'Aug 8, 2026');
	assert.equal(formatDateLabel('not-a-date'), undefined);
	assert.equal(formatDateLabel(undefined), undefined);
});

test('plainify strips markdown and frontmatter', () => {
	const input = `---
title: X
---
# Heading

Some **bold** [link](https://example.com) and ![img](img.png).`;
	assert.equal(plainify(input), 'Some bold link and .');
});

test('ogCardDataFor falls back to a plainified body excerpt', () => {
	const data = ogCardDataFor({
		siteName: 'Sabin Pokharel',
		title: 'My Post',
		body: 'A **long** body with a [[wikilink]] and more words.',
		tags: ['ai'],
		registry: { ai: { name: 'AI', slug: 'ai', accent_color: '#ae3ec9' } },
		section: 'blog',
		date: '2026-08-08'
	});
	assert.equal(data.siteName, 'Sabin Pokharel');
	assert.equal(data.accentColor, '#ae3ec9');
	assert.equal(data.sectionLabel, 'BLOG');
	assert.equal(data.dateLabel, 'Aug 8, 2026');
	assert.equal(data.monogram, 'SP');
	assert.match(data.excerpt ?? '', /wikilink/);
});

test('wrapText wraps and truncates with an ellipsis', () => {
	const text = 'one two three four five six';
	const { lines, truncated } = wrapText(text, 100, 20, 400, charWidth, 2);
	assert.equal(truncated, true);
	assert.ok(lines.length <= 2);
	assert.match(lines[lines.length - 1], /…$/);
});

test('computeOgLayout caps the title at three lines and shrinks the font', () => {
	const longTitle = 'The Quick Brown Fox Jumps Over The Lazy Dog While Thinking Deeply About The Nature Of Mathematical Truth And Its Role In Artificial Intelligence Systems';
	const { titleLines } = computeOgLayout(
		{
			siteName: 'Sabin',
			title: longTitle,
			accentColor: '#111111',
			monogram: 'SP'
		},
		charWidth
	);
	assert.ok(titleLines.length <= 3);
	assert.ok(titleLines[0].size < 72);
});
