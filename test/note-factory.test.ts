import assert from "node:assert/strict";
import test from "node:test";
import { parseYaml } from "../src/utils/yaml";

import { noteFileName, noteScaffold } from "../src/services/note-factory";

test("noteScaffold builds a post with full frontmatter", () => {
	const content = noteScaffold({
		title: "Hello world",
		type: "post",

		status: "draft",
		tags: ["ai", "math"],
		author: "Sapienskid"
	});

	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	assert.ok(match);
	const fm = parseYaml(match[1]);
	assert.equal(fm.title, "Hello world");
	assert.equal(fm.type, "post");
	assert.equal(fm.status, "draft");
	assert.equal(fm.slug, "hello-world");
	assert.deepEqual(fm.tags, ["ai", "math"]);
	assert.equal(fm.featured, false);
	assert.equal(fm.author, "Sapienskid");
	assert.ok(content.includes("# Hello world"));
});

test("noteScaffold omits empty tags and author", () => {
	const content = noteScaffold({
		title: "Untitled",
		type: "page",

		status: "draft",
		tags: [],
		author: ""
	});
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	assert.ok(match);
	const fm = parseYaml(match[1]);
	assert.equal(fm.slug, "untitled");
	assert.equal(fm.tags, undefined);
	assert.equal(fm.author, undefined);
});

test("noteFileName derives a slug filename", () => {
	assert.equal(
		noteFileName({ title: "My Post Title", type: "post", status: "draft", tags: [], author: "" }),
		"my-post-title.md"
	);
});
