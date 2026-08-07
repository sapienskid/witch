import assert from "node:assert/strict";
import test from "node:test";

import { S3Client } from "../src/services/s3-client";
import type { S3Request } from "../src/services/s3-client";
import { sha256Hex } from "../src/services/s3-client";

interface Call {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: Uint8Array;
}

function makeClient(responder: (call: Call) => { status: number; text: string }) {
	const calls: Call[] = [];
	const request: S3Request = async (url, method, headers, body) => {
		calls.push({ url, method, headers, body });
		return responder(calls[calls.length - 1]);
	};
	const client = new S3Client({
		endpoint: "https://account.r2.cloudflarestorage.com",
		region: "auto",
		credentials: {
			accessKeyId: "AKIDEXAMPLE",
			secretAccessKey: "SECRETKEYEXAMPLE"
		},
		request,
		now: () => new Date("2013-05-24T00:00:00Z")
	});
	return { client, calls };
}

test("putObject signs and uploads to the path-style URL", async () => {
	const { client, calls } = makeClient(() => ({ status: 200, text: "" }));

	const body = new TextEncoder().encode("hello");
	await client.putObject({
		bucket: "portfolio",
		key: "images/post.webp",
		body,
		contentType: "image/webp",
		metadata: { caption: "Cover" }
	});

	const call = calls[0];
	assert.equal(call.method, "PUT");
	assert.equal(call.url, "https://account.r2.cloudflarestorage.com/portfolio/images/post.webp");
	assert.ok(call.headers.Authorization.startsWith("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20130524/auto/s3/aws4_request"));
	assert.equal(call.headers["x-amz-content-sha256"], await sha256Hex(body));
	assert.equal(call.headers["x-amz-meta-caption"], "Cover");
	assert.equal(call.headers["Content-Type"], "image/webp");
});

test("headBucket and deleteObject use the right method and URL", async () => {
	const { client, calls } = makeClient(() => ({ status: 200, text: "" }));

	await client.headBucket("portfolio");
	await client.deleteObject("portfolio", "images/old.png");

	assert.equal(calls[0].method, "HEAD");
	assert.equal(calls[0].url, "https://account.r2.cloudflarestorage.com/portfolio");
	assert.equal(calls[1].method, "DELETE");
	assert.equal(calls[1].url, "https://account.r2.cloudflarestorage.com/portfolio/images/old.png");
});

test("listObjectsV2 parses the XML result", async () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>portfolio</Name>
  <Prefix>images/</Prefix>
  <KeyCount>2</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>images/a.webp</Key>
    <LastModified>2026-08-07T10:00:00.000Z</LastModified>
    <ETag>"abc"</ETag>
    <Size>2048</Size>
  </Contents>
  <Contents>
    <Key>images/b&c.png</Key>
    <LastModified>2026-08-07T11:00:00.000Z</LastModified>
    <ETag>"def"</ETag>
    <Size>1024</Size>
  </Contents>
</ListBucketResult>`;

	const { client, calls } = makeClient(() => ({ status: 200, text: xml }));
	const objects = await client.listObjectsV2("portfolio", "images/");

	assert.ok(calls[0].url.includes("list-type=2"));
	assert.ok(calls[0].url.includes("prefix=images%2F"));
	assert.equal(objects.length, 2);
	assert.equal(objects[0].key, "images/a.webp");
	assert.equal(objects[0].size, 2048);
	assert.equal(objects[1].key, "images/b&c.png");
	assert.equal(objects[1].size, 1024);
});
