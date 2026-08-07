import assert from "node:assert/strict";
import test from "node:test";

import type { TagEntry } from "../src/types/content";
import { tagNoteFor, tagNoteFromText } from "../src/services/tag-note";

test("tagNoteFor and tagNoteFromText round-trip", () => {
	const entry: TagEntry = {
		name: "AI",
		slug: "ai",
		description: "Artificial intelligence",
		accent_color: "#ae3ec9",
		visibility: "public",
		meta_title: "AI — Sabin's site",
		twitter_image: "https://img.example.com/ai.png"
	};

	const note = tagNoteFor(entry);
	assert.ok(note.startsWith("---\nname: AI\n"));
	assert.ok(note.includes("accent_color: '#ae3ec9'") || note.includes("accent_color: \"#ae3ec9\"") || note.includes("accent_color: '#ae3ec9'"));

	const back = tagNoteFromText(note);
	assert.equal(back.name, "AI");
	assert.equal(back.slug, "ai");
	assert.equal(back.description, "Artificial intelligence");
	assert.equal(back.accent_color, "#ae3ec9");
	assert.equal(back.visibility, "public");
	assert.equal(back.meta_title, "AI — Sabin's site");
	assert.equal(back.twitter_image, "https://img.example.com/ai.png");
});

test("tagNoteFromText handles missing frontmatter", () => {
	assert.deepEqual(tagNoteFromText("no frontmatter here"), { name: "", slug: "" });
});
