import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractBlock, extractSection, headingLevel, parseTransclusionTarget } from '../src/utils/transclusion';

test('parseTransclusionTarget splits path, fragment, and display', () => {
	assert.deepEqual(parseTransclusionTarget('note'), { path: 'note', fragment: undefined, display: undefined });
	assert.deepEqual(parseTransclusionTarget('note#heading'), { path: 'note', fragment: '#heading', display: undefined });
	assert.deepEqual(parseTransclusionTarget('note^block-id'), { path: 'note', fragment: '^block-id', display: undefined });
	assert.deepEqual(parseTransclusionTarget('note|Display text'), { path: 'note', fragment: undefined, display: 'Display text' });
	assert.deepEqual(parseTransclusionTarget('note#heading|Display text'), { path: 'note', fragment: '#heading', display: 'Display text' });
});

test('headingLevel counts leading hashes', () => {
	assert.equal(headingLevel('# Intro'), 1);
	assert.equal(headingLevel('### Deep'), 3);
	assert.equal(headingLevel('not a heading'), 0);
});

test('extractSection returns content under a heading until a sibling', () => {
	const markdown = `# Intro

Before.

## Part A

Alpha content.

### Sub

Nested.

## Part B

Beta content.
`;
	assert.equal(extractSection(markdown, 'Part A'), 'Alpha content.\n\n### Sub\n\nNested.');
	assert.equal(extractSection(markdown, 'part a'), 'Alpha content.\n\n### Sub\n\nNested.');
	assert.equal(extractSection(markdown, 'Missing'), undefined);
});

test('extractBlock returns the line with the block id', () => {
	const markdown = 'Some paragraph\n\n> A block quote ^quote1\n\nAnother line';
	assert.equal(extractBlock(markdown, 'quote1'), '> A block quote');
	assert.equal(extractBlock(markdown, 'nope'), undefined);
});
