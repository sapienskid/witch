import assert from "node:assert/strict";
import test from "node:test";

import { ContentApiClient } from "../src/services/content-api";
import type { ContentRequest } from "../src/services/content-api";
import { DEFAULT_SETTINGS } from "../src/types/settings";

interface Call {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
}

function makeClient(response: { status: number; text: string }) {
	const calls: Call[] = [];
	const requester: ContentRequest = async (url, method, headers, body) => {
		calls.push({ url, method, headers, body });
		return { status: response.status, text: response.text };
	};
	const client = new ContentApiClient(
		{ ...DEFAULT_SETTINGS, contentApiUrl: "https://witch-worker.example.workers.dev", contentApiToken: "secret" },
		requester
	);
	return { client, calls };
}

test("putContent uploads to the content key with bearer auth", async () => {
	const { client, calls } = makeClient({ status: 200, text: '{"ok":true}' });
	await client.putContent("blog/hello.md", "---\n---\nBody");

	assert.equal(calls.length, 1);
	assert.equal(calls[0].method, "PUT");
	assert.equal(calls[0].url, "https://witch-worker.example.workers.dev/api/content/blog%2Fhello.md");
	assert.equal(calls[0].headers.Authorization, "Bearer secret");
	assert.equal(calls[0].body, "---\n---\nBody");
});

test("getContent returns null on 404", async () => {
	const { client } = makeClient({ status: 404, text: "Not found" });
	assert.equal(await client.getContent("blog/missing.md"), null);
});

test("getManifest parses keys", async () => {
	const { client } = makeClient({ status: 200, text: '{"keys":["blog/a.md","tags.json"]}' });
	assert.deepEqual(await client.getManifest(), ["blog/a.md", "tags.json"]);
});

test("deleteContent and triggerBuild issue the right calls", async () => {
	const { client, calls } = makeClient({ status: 200, text: "{}" });
	await client.deleteContent("blog/a.md");
	await client.triggerBuild();

	assert.equal(calls[0].method, "DELETE");
	assert.equal(calls[0].url.endsWith("/api/content/blog%2Fa.md"), true);
	assert.equal(calls[1].method, "POST");
	assert.equal(calls[1].url.endsWith("/api/build"), true);
});

test("non-2xx responses throw", async () => {
	const { client } = makeClient({ status: 500, text: "boom" });
	await assert.rejects(() => client.putContent("blog/a.md", "Body"), /HTTP 500/);
});

test("getImages parses media items", async () => {
	const { client } = makeClient({ status: 200, text: '{"images":[{"key":"post.webp","size":2048,"uploaded":"2026-08-07T00:00:00.000Z"}]}' });
	const images = await client.getImages();
	assert.equal(images.length, 1);
	assert.equal(images[0].key, "post.webp");
	assert.equal(images[0].size, 2048);
});

test("deleteImage issues a DELETE against the images route", async () => {
	const { client, calls } = makeClient({ status: 200, text: '{"ok":true}' });
	await client.deleteImage("post.webp");
	assert.equal(calls[0].method, "DELETE");
	assert.equal(calls[0].url.endsWith("/api/images/post.webp"), true);
});
