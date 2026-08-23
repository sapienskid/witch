import assert from "node:assert/strict";
import test from "node:test";
import { convertHighlights } from "../src/utils/highlights";

test("convertHighlights turns ==text== into <mark>text</mark>", () => {
	const input = "The capital of France is ==c1::Paris== and it has ==c2::2.1 million== people.";
	const expected = "The capital of France is <mark>c1::Paris</mark> and it has <mark>c2::2.1 million</mark> people.";
	assert.equal(convertHighlights(input), expected);
});

test("convertHighlights preserves == inside code blocks and inline code", () => {
	const input = "Prose ==highlight== here.\n```markdown\n==c1::Paris==\n```\nAnd `==inline==` code.";
	const expected = "Prose <mark>highlight</mark> here.\n```markdown\n==c1::Paris==\n```\nAnd `==inline==` code.";
	assert.equal(convertHighlights(input), expected);
});

test("convertHighlights preserves == inside math blocks", () => {
	const input = "Math $a == b$ and $$x == y$$ and prose ==highlighted==.";
	const expected = "Math $a == b$ and $$x == y$$ and prose <mark>highlighted</mark>.";
	assert.equal(convertHighlights(input), expected);
});
