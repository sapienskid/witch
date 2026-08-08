import assert from "node:assert/strict";
import test from "node:test";

import { getMimeType, isAudioExtension, isImageExtension, isMediaExtension, isPdfExtension, isVideoExtension, youtubeId } from "../src/utils/media";

test("isImageExtension supports known formats", () => {
	assert.equal(isImageExtension("png"), true);
	assert.equal(isImageExtension("WEBP"), true);
	assert.equal(isImageExtension("pdf"), false);
});

test("getMimeType resolves supported types and falls back", () => {
	assert.equal(getMimeType("jpg"), "image/jpeg");
	assert.equal(getMimeType("svg"), "image/svg+xml");
	assert.equal(getMimeType("mp4"), "video/mp4");
	assert.equal(getMimeType("mp3"), "audio/mpeg");
	assert.equal(getMimeType("pdf"), "application/pdf");
	assert.equal(getMimeType("unknown"), "application/octet-stream");
});

test("media extension helpers classify video, audio, and pdf", () => {
	assert.equal(isVideoExtension("MP4"), true);
	assert.equal(isVideoExtension("webm"), true);
	assert.equal(isAudioExtension("mp3"), true);
	assert.equal(isPdfExtension("pdf"), true);
	assert.equal(isMediaExtension("mp4"), true);
	assert.equal(isMediaExtension("mp3"), true);
	assert.equal(isMediaExtension("pdf"), true);
	assert.equal(isMediaExtension("png"), false);
});

test("youtubeId extracts the video id from common URL shapes", () => {
	assert.equal(youtubeId("https://www.youtube.com/watch?v=abc123XYZ"), "abc123XYZ");
	assert.equal(youtubeId("https://youtu.be/abc123XYZ"), "abc123XYZ");
	assert.equal(youtubeId("https://youtube.com/shorts/abc123XYZ"), "abc123XYZ");
	assert.equal(youtubeId("https://youtube.com/embed/abc123XYZ"), "abc123XYZ");
	assert.equal(youtubeId("https://example.com/video.mp4"), undefined);
});
