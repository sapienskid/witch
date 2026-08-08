import assert from 'node:assert/strict';
import { test } from 'node:test';

import { convertCallouts } from '../src/utils/callouts';

test('convertCallouts turns a simple callout into a shortcode', () => {
	const input = `> [!note] A title
> Some content here.
> Another line.`;
	assert.equal(
		convertCallouts(input),
		'{{< callout type="note" title="A title" >}}\nSome content here.\nAnother line.\n{{< /callout >}}\n'
	);
});

test('convertCallouts handles a titleless callout', () => {
	const input = `> [!tip]
> Just a tip.`;
	assert.equal(convertCallouts(input), '{{< callout type="tip" >}}\nJust a tip.\n{{< /callout >}}\n');
});

test('convertCallouts preserves blank separators inside a callout', () => {
	const input = `> [!warning] Heads up
> First paragraph.
>
> Second paragraph.`;
	assert.equal(
		convertCallouts(input),
		'{{< callout type="warning" title="Heads up" >}}\nFirst paragraph.\n\nSecond paragraph.\n{{< /callout >}}\n'
	);
});

test('convertCallouts leaves ordinary blockquotes and other text alone', () => {
	const input = `> Just a quote

Normal paragraph with \`{{< callout >}}\` that should stay.`;
	assert.equal(convertCallouts(input), input);
});
