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
type: post
tags: [obsidian, ghost]
keywords: [release, notes]
featured: true
published_at: 2026-03-09
---
Hello from body`;

	const parsed = parseFrontmatter(input);

	assert.equal(parsed.metadata.title, "Release prep");
	assert.equal(parsed.metadata.status, "scheduled");
	assert.equal(parsed.metadata.type, "post");
	assert.deepEqual(parsed.metadata.tags, ["obsidian", "ghost"]);
	assert.deepEqual(parsed.metadata.keywords, ["release", "notes"]);
	assert.equal(parsed.metadata.featured, true);
	assert.equal(parsed.metadata.published_at, "2026-03-09");
	assert.equal(parsed.markdownContent, "Hello from body");
});

test("parseFrontmatter reads date, slug, and SEO fields", () => {
	const input = `---
title: My post
slug: my-post
date: 2026-08-07
meta_title: SEO title
og_image: https://example.com/og.png
author: Sapienskid
---
Body`;

	const parsed = parseFrontmatter(input);

	assert.equal(parsed.metadata.date, "2026-08-07");
	assert.equal(parsed.metadata.slug, "my-post");
	assert.equal(parsed.metadata.meta_title, "SEO title");
	assert.equal(parsed.metadata.og_image, "https://example.com/og.png");
	assert.equal(parsed.metadata.author, "Sapienskid");
});

test("parseFrontmatter reads canonical, feature alt, and code injection", () => {
	const input = `---
title: My post
canonical_url: https://example.com/my-post
feature_image_alt: Cover image
codeinjection_head: <meta name="robots" content="index">
codeinjection_foot: <script>console.log("hi")</script>
---
Body`;

	const parsed = parseFrontmatter(input);

	assert.equal(parsed.metadata.canonical_url, "https://example.com/my-post");
	assert.equal(parsed.metadata.feature_image_alt, "Cover image");
	assert.equal(parsed.metadata.codeinjection_head, '<meta name="robots" content="index">');
	assert.equal(parsed.metadata.codeinjection_foot, '<script>console.log("hi")</script>');
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
