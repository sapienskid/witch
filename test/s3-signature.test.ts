import assert from "node:assert/strict";
import test from "node:test";

import { sha256Hex, signAwsRequest } from "../src/services/s3-client";

test("sha256Hex matches the empty-payload hash", async () => {
	assert.equal(
		await sha256Hex(""),
		"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	);
});

test("signAwsRequest reproduces the AWS S3 GET Object test vector", async () => {
	const result = await signAwsRequest({
		method: "GET",
		canonicalUri: "/test.txt",
		canonicalQuery: "",
		headers: {
			host: "examplebucket.s3.amazonaws.com",
			range: "bytes=0-9",
			"x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			"x-amz-date": "20130524T000000Z"
		},
		payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		accessKeyId: "AKIAIOSFODNN7EXAMPLE",
		secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		region: "us-east-1",
		service: "s3",
		date: new Date("2013-05-24T00:00:00Z")
	});

	assert.equal(result.amzDate, "20130524T000000Z");
	assert.equal(result.signedHeaders, "host;range;x-amz-content-sha256;x-amz-date");
	assert.ok(result.authorization.includes("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"));
});
