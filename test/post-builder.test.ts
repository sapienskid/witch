import assert from "node:assert/strict";
import test from "node:test";
import type { TFile } from "obsidian";

import { PostBuilder } from "../src/services/post-builder";
import { DEFAULT_SETTINGS } from "../src/types/settings";

test("prepareGhostPost builds payload from defaults and frontmatter", () => {
	const settings = {
		...DEFAULT_SETTINGS,
		defaultStatus: "draft" as const,
		defaultAuthor: "writer@example.com, Guest Author",
		defaultTags: "ghost, release"
	};
	const builder = new PostBuilder(settings);

	const post = builder.prepareGhostPost(
		{ basename: "Hello world" } as unknown as TFile,
		{
			title: "Hello world",
			tags: ["Ghost", "obsidian"],
			status: "published",
			excerpt: "Summary"
		},
		"<p>Post body</p>",
		[{ id: "1", name: "Ghost", slug: "ghost" }]
	);

	assert.equal(post.title, "Hello world");
	assert.equal(post.status, "published");
	assert.equal(post.slug, "hello-world");
	assert.equal(post.excerpt, "Summary");
	assert.deepEqual(post.tags, [
		{ name: "Ghost", slug: "ghost" },
		{ name: "obsidian", slug: "obsidian" },
		{ name: "release", slug: "release" }
	]);
	assert.deepEqual(post.authors, ["writer@example.com", { slug: "guest-author" }]);
});

test("generateSlug and splitTagString normalize user input", () => {
	const builder = new PostBuilder(DEFAULT_SETTINGS);

	assert.equal(builder.generateSlug("Hello, World!!"), "hello-world");
	assert.deepEqual(builder.splitTagString("[tag-a, tag-b]"), ["tag-a", "tag-b"]);
	assert.deepEqual(builder.splitTagString("  "), []);
});
