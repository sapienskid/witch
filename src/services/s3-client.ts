export interface S3Request {
	(url: string, method: string, headers: Record<string, string>, body?: Uint8Array): Promise<{ status: number; text: string }>;
}

export interface S3Credentials {
	accessKeyId: string;
	secretAccessKey: string;
}

export interface S3ClientConfig {
	endpoint: string;
	region: string;
	credentials: S3Credentials;
	request: S3Request;
	now?: () => Date;
}

export interface PutObjectInput {
	bucket: string;
	key: string;
	body: Uint8Array;
	contentType: string;
	cacheControl?: string;
	metadata?: Record<string, string>;
}

export interface S3Object {
	key: string;
	size: number;
	lastModified: string;
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const encoder = new TextEncoder();

function toBytes(input: string | Uint8Array): Uint8Array<ArrayBuffer> {
	if (typeof input === 'string') {
		return encoder.encode(input);
	}
	const copy = new Uint8Array(input.byteLength);
	copy.set(input);
	return copy;
}

function toHex(bytes: Uint8Array): string {
	return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', toBytes(input));
	return toHex(new Uint8Array(digest));
}

async function hmac(key: Uint8Array<ArrayBuffer>, input: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', cryptoKey, input);
	return new Uint8Array(signature);
}

export async function hmacHex(key: Uint8Array<ArrayBuffer>, input: string | Uint8Array): Promise<string> {
	return toHex(await hmac(key, toBytes(input)));
}

async function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Promise<Uint8Array<ArrayBuffer>> {
	const kDate = await hmac(toBytes(`AWS4${secret}`), toBytes(dateStamp));
	const kRegion = await hmac(kDate, toBytes(region));
	const kService = await hmac(kRegion, toBytes(service));
	return hmac(kService, toBytes('aws4_request'));
}

export interface SignRequestInput {
	method: string;
	canonicalUri: string;
	canonicalQuery: string;
	headers: Record<string, string>;
	payloadHash: string;
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	service: string;
	date: Date;
}

export interface SignRequestOutput {
	authorization: string;
	amzDate: string;
	signedHeaders: string;
}

export async function signAwsRequest(input: SignRequestInput): Promise<SignRequestOutput> {
	const amzDate = formatAmzDate(input.date);
	const dateStamp = formatDateStamp(input.date);

	const { canonical, signed } = canonicalHeaders(input.headers);
	const signedHeaders = signed.join(';');

	const canonicalRequest = `${input.method}\n${input.canonicalUri}\n${input.canonicalQuery}\n${canonical}\n${signedHeaders}\n${input.payloadHash}`;
	const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
	const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
	const signingKey = await getSigningKey(input.secretAccessKey, dateStamp, input.region, input.service);
	const signature = await hmacHex(signingKey, stringToSign);

	return {
		amzDate,
		signedHeaders,
		authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
	};
}

export class S3Client {
	private readonly host: string;

	constructor(private readonly config: S3ClientConfig) {
		this.host = new URL(config.endpoint).host;
	}

	async headBucket(bucket: string): Promise<void> {
		await this.send('HEAD', `/${bucket}`, {}, undefined);
	}

	async putObject(input: PutObjectInput): Promise<void> {
		const headers: Record<string, string> = {
			'Content-Type': input.contentType,
			'Cache-Control': input.cacheControl ?? 'public, max-age=31536000'
		};
		for (const [key, value] of Object.entries(input.metadata ?? {})) {
			headers[`x-amz-meta-${key}`] = value;
		}
		await this.send('PUT', `/${input.bucket}/${encodeKey(input.key)}`, headers, input.body);
	}

	async deleteObject(bucket: string, key: string): Promise<void> {
		await this.send('DELETE', `/${bucket}/${encodeKey(key)}`, {}, undefined);
	}

	async listObjectsV2(bucket: string, prefix: string): Promise<S3Object[]> {
		const query: Record<string, string> = { 'list-type': '2' };
		if (prefix) {
			query.prefix = prefix;
		}
		const response = await this.send('GET', `/${bucket}`, {}, undefined, query);
		return parseListBucketResult(response.text);
	}

	private async send(
		method: string,
		path: string,
		extraHeaders: Record<string, string>,
		body: Uint8Array | undefined,
		query: Record<string, string> = {}
	): Promise<{ status: number; text: string }> {
		const date = this.config.now ? this.config.now() : new Date();
		const payloadHash = body ? await sha256Hex(body) : EMPTY_SHA256;

		const headers: Record<string, string> = {
			host: this.host,
			'x-amz-date': formatAmzDate(date),
			'x-amz-content-sha256': payloadHash,
			...extraHeaders
		};

		const canonicalUri = encodePath(path);
		const canonicalQuery = encodeQuery(query);
		const signed = await signAwsRequest({
			method,
			canonicalUri,
			canonicalQuery,
			headers,
			payloadHash,
			accessKeyId: this.config.credentials.accessKeyId,
			secretAccessKey: this.config.credentials.secretAccessKey,
			region: this.config.region,
			service: 's3',
			date
		});
		headers.Authorization = signed.authorization;

		const url = `${this.config.endpoint}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
		const requestHeaders = { ...headers };
		delete requestHeaders.host;
		return this.config.request(url, method, requestHeaders, body);
	}
}

function canonicalHeaders(headers: Record<string, string>): { canonical: string; signed: string[] } {
	const entries = Object.entries(headers)
		.filter(([name]) => name.toLowerCase() !== 'authorization')
		.map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')] as const)
		.sort((a, b) => a[0].localeCompare(b[0]));
	const signed = entries.map(entry => entry[0]);
	const canonical = entries.map(([name, value]) => `${name}:${value}\n`).join('');
	return { canonical, signed };
}

function awsUriEncode(input: string): string {
	return encodeURIComponent(input).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeKey(key: string): string {
	return key.split('/').map(segment => awsUriEncode(segment)).join('/');
}

function encodePath(path: string): string {
	return path.split('/').map(segment => awsUriEncode(segment)).join('/');
}

function encodeQuery(query: Record<string, string>): string {
	const keys = Object.keys(query).sort();
	if (keys.length === 0) {
		return '';
	}
	return keys.map(key => `${awsUriEncode(key)}=${awsUriEncode(query[key])}`).join('&');
}

function formatAmzDate(date: Date): string {
	const time = date.toISOString().slice(11, 19).replace(/:/g, '');
	return `${formatDateStamp(date)}T${time}Z`;
}

function formatDateStamp(date: Date): string {
	return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseListBucketResult(xml: string): S3Object[] {
	const objects: S3Object[] = [];
	const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
	let match: RegExpExecArray | null;
	while ((match = contentsRe.exec(xml)) !== null) {
		const block = match[1];
		const key = decodeXml(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '');
		const size = Number(block.match(/<Size>([\s\S]*?)<\/Size>/)?.[1] ?? 0);
		const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? '';
		objects.push({ key, size, lastModified });
	}
	return objects;
}

function decodeXml(value: string): string {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}
