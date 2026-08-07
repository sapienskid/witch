import assert from "node:assert/strict";
import test from "node:test";

import type { FileStore } from "../src/services/file-store";
import { TagManager } from "../src/services/tag-manager";
import type { TagRegistry } from "../src/types/content";
import { DEFAULT_SETTINGS } from "../src/types/settings";

function makeStore(seed: Record<string, string> = {}): { store: FileStore; data: Map<string, string> } {
	const data = new Map(Object.entries(seed));
	const store: FileStore = {
		readText: async path => data.get(path) ?? null,
		writeText: async (path, content) => {
			data.set(path, content);
		},
		deleteFile: async path => {
			data.delete(path);
		},
		listNotes: async dir => [...data.keys()].filter(key => key.startsWith(`${dir}/`) && key.endsWith(".md"))
	};
	return { store, data };
}

test("ensureTags creates per-tag notes for missing tags", async () => {
	const { store, data } = makeStore();
	const manager = new TagManager(DEFAULT_SETTINGS, store);

	const registry = await manager.ensureTags(["AI", "Math"]);

	assert.ok(registry.ai);
	assert.equal(registry.ai.name, "AI");
	assert.equal(registry.ai.slug, "ai");
	assert.equal(registry.math.slug, "math");

	const aiNote = data.get("Site/tags/ai.md");
	assert.ok(aiNote?.includes("name: AI"));
	assert.ok(aiNote?.includes("slug: ai"));
	assert.ok(data.has("Site/tags/math.md"));
});

test("getRegistry reads tag notes back", async () => {
	const seeded = makeStore({
		"Site/tags/ai.md": `---\nname: AI\nslug: ai\ndescription: Artificial intelligence\n---\nBody\n`
	});
	const manager = new TagManager(DEFAULT_SETTINGS, seeded.store);

	const registry = await manager.getRegistry();
	assert.equal(registry.ai?.name, "AI");
	assert.equal(registry.ai?.description, "Artificial intelligence");

	const empty = new TagManager(DEFAULT_SETTINGS, makeStore().store);
	assert.deepEqual(await empty.getRegistry(), {});
});

test("saveEntry and deleteTag write and remove tag notes", async () => {
	const { store, data } = makeStore();
	const manager = new TagManager(DEFAULT_SETTINGS, store);

	await manager.saveEntry({ name: "SEO", slug: "seo", description: "Search optimization" });
	assert.ok(data.has("Site/tags/seo.md"));

	await manager.deleteTag("seo");
	assert.equal(data.has("Site/tags/seo.md"), false);
});

test("ensureTags skips internal tags", async () => {
	const { store, data } = makeStore();
	const manager = new TagManager(DEFAULT_SETTINGS, store);
	await manager.ensureTags(["#feature", "AI"]);
	assert.ok(data.has("Site/tags/ai.md"));
	assert.equal([...data.keys()].filter(key => key.startsWith("Site/tags/")).length, 1);
});

test("scanTagsFrom derives tags and counts from notes, skipping sections", () => {
	const manager = new TagManager(DEFAULT_SETTINGS, makeStore().store);

	const counts = manager.scanTagsFrom([
		{ tags: ["AI", "blog"] },
		{ tags: ["ai", "math"] },
		{ tags: ["math"] },
		{ tags: [] }
	]);

	assert.deepEqual(counts, [
		{ slug: "ai", name: "AI", count: 2 },
		{ slug: "math", name: "math", count: 2 }
	]);

	const withSections = manager.scanTagsFrom([{ tags: ["blog", "ai"] }], []);
	assert.deepEqual(withSections, [
		{ slug: "blog", name: "blog", count: 1 },
		{ slug: "ai", name: "ai", count: 1 }
	]);
});

test("scanTagsFrom ignores internal tags", () => {
	const manager = new TagManager(DEFAULT_SETTINGS, makeStore().store);
	const counts = manager.scanTagsFrom([{ tags: ["#feature", "ai"] }, { tags: ["#feature"] }]);
	assert.deepEqual(counts, [{ slug: "ai", name: "ai", count: 1 }]);
});

test("unionTags combines note tags with registry-only tags", () => {
	const manager = new TagManager(DEFAULT_SETTINGS, makeStore().store);
	const registry = {
		seo: { name: "SEO", slug: "seo", description: "Search optimization" }
	} as TagRegistry;

	const union = manager.unionTags(
		[{ tags: ["AI"] }, { tags: ["math"] }, { tags: [] }],
		registry
	);

	assert.equal(union.length, 3);
	const ai = union.find(item => item.entry.slug === "ai");
	assert.equal(ai?.count, 1);
	const seo = union.find(item => item.entry.slug === "seo");
	assert.equal(seo?.count, 0);
	assert.equal(seo?.entry.description, "Search optimization");
});
