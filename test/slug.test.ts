import assert from "node:assert/strict";
import test from "node:test";

import { generateSlug, splitTags } from "../src/utils/slug";

test("generateSlug normalizes titles", () => {
	assert.equal(generateSlug("Hello, World!!"), "hello-world");
	assert.equal(generateSlug("My  Post   Title"), "my-post-title");
	assert.equal(generateSlug("Café 100%"), "caf-100");
	assert.equal(generateSlug("  Trimmed  "), "trimmed");
});

test("splitTags parses bracket and comma lists", () => {
	assert.deepEqual(splitTags("[tag-a, tag-b]"), ["tag-a", "tag-b"]);
	assert.deepEqual(splitTags("a, b"), ["a", "b"]);
	assert.deepEqual(splitTags("  "), []);
	assert.deepEqual(splitTags(undefined), []);
});
