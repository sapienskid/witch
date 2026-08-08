import assert from "node:assert/strict";
import test from "node:test";
import { parseYaml } from "../src/utils/yaml";

import type { ContentMetadata, PublishedContent } from "../src/types/content";
import { buildContent, computeKey, resolveSection } from "../src/services/site-content";

const SECTION_TAGS = ["blog", "portfolio", "flashcards"];

function frontmatterOf(content: PublishedContent): Record<string, unknown> {
	const match = content.content.match(/^---\n([\s\S]*?)\n---\n/);
	assert.ok(match, "content should start with YAML frontmatter");
	return parseYaml(match[1]);
}

function post(overrides: ContentMetadata = {}): ContentMetadata {
	return {
		title: "Hello world",

		status: "published",
		tags: ["AI", "blog"],
		slug: "hello-world",
		date: "2026-08-07",
		...overrides
	};
}

test("buildContent routes a post into its section", () => {
	const result = buildContent({ metadata: post(), body: "Body text", title: "Hello world" }, SECTION_TAGS);
	assert.equal(result.key, "blog/hello-world.md");

	const fm = frontmatterOf(result);
	assert.equal(fm.title, "Hello world");
	assert.equal(fm.date, "2026-08-07");
	assert.equal(fm.draft, false);
	assert.equal(fm.section, "blog");
	assert.deepEqual(fm.tags, ["ai"]);
	assert.deepEqual(fm.tag_names, ["AI"]);
});

test("buildContent routes a page to a _index key", () => {
	const result = buildContent(
		{ metadata: post({ type: "page", tags: [], slug: "about" }), body: "About", title: "About" },
		SECTION_TAGS
	);
	assert.equal(result.key, "about/_index.md");
});

test("resolveSection falls back to a matching section tag", () => {
	const metadata = { title: "Card", tags: ["flashcards", "math"], slug: "cards" };
	const built = buildContent({ metadata, body: "Body", title: "Card" }, SECTION_TAGS);
	assert.equal(built.key, "flashcards/cards.md");
	assert.deepEqual(frontmatterOf(built).tags, ["math"]);
});

test("draft notes stay marked draft", () => {
	const fm = frontmatterOf(buildContent({ metadata: post({ status: "draft" }), body: "Body", title: "Draft" }, SECTION_TAGS));
	assert.equal(fm.draft, true);
});

test("scheduled notes are draft until their date passes", () => {
	const future = "2999-01-01T00:00:00.000Z";
	const fm = frontmatterOf(
		buildContent({ metadata: post({ status: "scheduled", published_at: future }), body: "Body", title: "Later" }, SECTION_TAGS)
	);
	assert.equal(fm.draft, true);
	assert.equal(fm.published_at, future);
});

test("buildContent computes reading time from the body", () => {
	const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
	const fm = frontmatterOf(buildContent({ metadata: post(), body: words, title: "Long" }, SECTION_TAGS));
	assert.ok((fm.reading_time as number) >= 2);
});

test("buildContent carries SEO, feature image, excerpt, and author", () => {
	const fm = frontmatterOf(
		buildContent(
			{
				metadata: post({
					excerpt: "Short summary",
					meta_title: "SEO title",
					keywords: ["ai", "math"],
					author: "Sapienskid"
				}),
				body: "Body",
				title: "Hello world",
				featureImageUrl: "https://example.com/cover.webp"
			},
			SECTION_TAGS
		)
	);
	assert.equal(fm.excerpt, "Short summary");
	assert.equal(fm.feature_image, "https://example.com/cover.webp");
	assert.equal(fm.meta_title, "SEO title");
	assert.deepEqual(fm.keywords, ["ai", "math"]);
	assert.equal(fm.author, "Sapienskid");
});

test("tag_names prefer the tag registry over title case", () => {
	const registry = { ai: { name: "Artificial Intelligence", slug: "ai" } };
	const fm = frontmatterOf(
		buildContent({ metadata: post(), body: "Body", title: "Hello world", registry }, SECTION_TAGS)
	);
	assert.deepEqual(fm.tag_names, ["Artificial Intelligence"]);
});

test("computeKey uses the default section when none resolves", () => {
	const key = computeKey({ title: "Lone post", slug: "lone" }, "Lone post", SECTION_TAGS);
	assert.equal(key, "blog/lone.md");
});

test("resolveSection matches tags case-insensitively via slug", () => {
	assert.equal(resolveSection({ tags: ["Blog"] }, SECTION_TAGS), "blog");
	assert.equal(resolveSection({ tags: ["unrelated"] }, SECTION_TAGS), undefined);
});

test("buildContent emits featured, primary tag, and internal tags", () => {
	const fm = frontmatterOf(
		buildContent(
			{
				metadata: post({ featured: true, tags: ["AI", "blog", "#feature"] }),
				body: "Body",
				title: "Hello world"
			},
			SECTION_TAGS
		)
	);
	assert.equal(fm.featured, true);
	assert.equal(fm.primary_tag, "ai");
	assert.deepEqual(fm.tags, ["ai"]);
	assert.deepEqual(fm.internal_tags, ["feature"]);
});

test("internal tags never become public tags or archives", () => {
	const result = buildContent(
		{ metadata: { title: "Only internal", tags: ["#flag", "math"], slug: "only-internal" }, body: "Body", title: "Only internal" },
		SECTION_TAGS
	);
	const fm = frontmatterOf(result);
	assert.deepEqual(fm.tags, ["math"]);
	assert.deepEqual(fm.internal_tags, ["flag"]);
});

test("buildContent carries canonical URL, code injection, and image alt", () => {
	const fm = frontmatterOf(
		buildContent(
			{
				metadata: post({
					canonical_url: "https://example.com/hello-world",
					codeinjection_head: "<meta name='robots' content='index'>",
					codeinjection_foot: "<script>console.log('hi')</script>",
					feature_image_alt: "Cover illustration"
				}),
				body: "Body",
				title: "Hello world",
				featureImageUrl: "https://img.example.com/cover.webp"
			},
			SECTION_TAGS
		)
	);
	assert.equal(fm.canonical_url, "https://example.com/hello-world");
	assert.equal(fm.codeinjection_head, "<meta name='robots' content='index'>");
	assert.equal(fm.codeinjection_foot, "<script>console.log('hi')</script>");
	assert.equal(fm.feature_image_alt, "Cover illustration");
});

test("generated og image fills og_image and twitter_image unless a custom one exists", () => {
	const generated = frontmatterOf(
		buildContent(
			{ metadata: post(), body: "Body", title: "Hello world", ogImageUrl: "https://cdn.pokharelsabin.com.np/og/hello-world.webp" },
			SECTION_TAGS
		)
	);
	assert.equal(generated.og_image, "https://cdn.pokharelsabin.com.np/og/hello-world.webp");
	assert.equal(generated.twitter_image, "https://cdn.pokharelsabin.com.np/og/hello-world.webp");

	const custom = frontmatterOf(
		buildContent(
			{
				metadata: post({ og_image: "https://img.example.com/custom.png" }),
				body: "Body",
				title: "Hello world",
				ogImageUrl: "https://cdn.pokharelsabin.com.np/og/hello-world.webp"
			},
			SECTION_TAGS
		)
	);
	assert.equal(custom.og_image, "https://img.example.com/custom.png");
	assert.equal(custom.twitter_image, undefined);
});
