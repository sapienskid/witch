import assert from "node:assert/strict";
import test from "node:test";

import { getMimeType, isImageExtension } from "../src/utils/media";

test("isImageExtension supports known formats", () => {
	assert.equal(isImageExtension("png"), true);
	assert.equal(isImageExtension("WEBP"), true);
	assert.equal(isImageExtension("pdf"), false);
});

test("getMimeType resolves supported types and falls back", () => {
	assert.equal(getMimeType("jpg"), "image/jpeg");
	assert.equal(getMimeType("svg"), "image/svg+xml");
	assert.equal(getMimeType("unknown"), "application/octet-stream");
});
