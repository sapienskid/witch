import assert from "node:assert/strict";
import test from "node:test";

import {
	parseArrayValue,
	parseBooleanValue,
	parseFrontmatter,
	parseStringValue
} from "../src/utils/frontmatter-parser";

test("parseFrontmatter extracts metadata and body content", () => {
	const input = `---
title: Release prep
status: scheduled
tags: [obsidian, ghost]
featured: true
published_at: 2026-03-09
---
Hello from body`;

	const parsed = parseFrontmatter(input);

	assert.equal(parsed.metadata.title, "Release prep");
	assert.equal(parsed.metadata.status, "scheduled");
	assert.deepEqual(parsed.metadata.tags, ["obsidian", "ghost"]);
	assert.equal(parsed.metadata.featured, true);
	assert.equal(parsed.metadata.published_at?.includes("2026"), true);
	assert.equal(parsed.markdownContent, "Hello from body");
});

test("parseFrontmatter returns original content on invalid YAML", () => {
	const input = `---
title: Broken
tags: [a, b
---
Body content`;
	const warn = console.warn;
	let parsed: ReturnType<typeof parseFrontmatter>;
	try {
		console.warn = () => {};
		parsed = parseFrontmatter(input);
	} finally {
		console.warn = warn;
	}

	assert.deepEqual(parsed.metadata, {});
	assert.equal(parsed.markdownContent, input);
});

test("string, boolean, and array helpers normalize values", () => {
	assert.equal(parseStringValue('"quoted"'), "quoted");
	assert.equal(parseBooleanValue("YES"), true);
	assert.equal(parseBooleanValue("no"), false);
	assert.deepEqual(parseArrayValue("[a, b, c]"), ["a", "b", "c"]);
	assert.deepEqual(parseArrayValue("a, b"), ["a", "b"]);
});
