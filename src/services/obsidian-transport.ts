import { requestUrl } from 'obsidian';

import type { ContentRequest } from './content-api';
import type { S3Request } from './s3-client';

export const obsidianRequest: ContentRequest = async (url, method, headers, body) => {
	const response = await requestUrl({ url, method, headers, body });
	return { status: response.status, text: response.text };
};

export const obsidianS3Request: S3Request = async (url, method, headers, body) => {
	const response = await requestUrl({
		url,
		method,
		headers,
		body: body ? toArrayBuffer(body) : undefined,
		throw: false
	});
	return { status: response.status, text: response.text };
};

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(view.byteLength);
	copy.set(view);
	return copy.buffer;
}
