import assert from "node:assert/strict";
import test from "node:test";

import { parseYaml, stringifyYaml } from "../src/utils/yaml";

test("parseYaml handles flat scalars, arrays, booleans, and numbers", () => {
	const parsed = parseYaml(`
title: Hello, world
status: published
featured: true
reading_time: 4
tags: [ai, math]
keywords:
  - notes
  - obsidian
excerpt: A short summary.
`);
	assert.equal(parsed.title, "Hello, world");
	assert.equal(parsed.status, "published");
	assert.equal(parsed.featured, true);
	assert.equal(parsed.reading_time, 4);
	assert.deepEqual(parsed.tags, ["ai", "math"]);
	assert.deepEqual(parsed.keywords, ["notes", "obsidian"]);
	assert.equal(parsed.excerpt, "A short summary.");
});

test("parseYaml keeps dates as strings and ignores comments", () => {
	const parsed = parseYaml(`
date: 2026-08-07
published_at: 2026-08-07T10:00:00+05:45
# a comment
title: My post  # trailing
`);
	assert.equal(parsed.date, "2026-08-07");
	assert.equal(parsed.published_at, "2026-08-07T10:00:00+05:45");
	assert.equal(parsed.title, "My post");
});

test("parseYaml handles quoted strings and block scalars", () => {
	const parsed = parseYaml(`
title: "Sabin's site"
nav: |-
  Blog | /blog
  About | /about
`);
	assert.equal(parsed.title, "Sabin's site");
	assert.equal(parsed.nav, "Blog | /blog\nAbout | /about");
});

test("parseYaml throws on unclosed arrays and quotes", () => {
	assert.throws(() => parseYaml("tags: [a, b"));
	assert.throws(() => parseYaml('title: "unclosed'));
});

test("stringifyYaml round-trips through parseYaml", () => {
	const obj = {
		title: "Hello: world",
		status: "published",
		featured: true,
		tags: ["ai", "math"],
		keywords: ["notes"],
		meta_description: "A, comma and # hash",
		codeinjection_head: '<meta name="robots" content="index">',
		author: "Sabin's site"
	};
	const text = stringifyYaml(obj);
	const parsed = parseYaml(text);
	assert.deepEqual(parsed, obj);
});

test("stringifyYaml emits null and empty values", () => {
	assert.equal(stringifyYaml({ title: "X", tags: [], missing: null }), "title: X\ntags: []\nmissing: null\n");
});
