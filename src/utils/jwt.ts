const JWT_AUDIENCE = '/admin/';

export async function generateGhostAdminToken(apiKey: string): Promise<string> {
	const [keyId, secret] = apiKey.split(':');

	if (!keyId || !secret) {
		throw new Error('Invalid Admin API key format. Expected keyId:secret');
	}

	const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: keyId }));
	const payload = base64UrlEncode(
		JSON.stringify({
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 5 * 60,
			aud: JWT_AUDIENCE
		})
	);

	const data = `${header}.${payload}`;
	const signature = await sign(data, secret);

	return `${data}.${signature}`;
}

export function base64UrlEncode(input: string): string {
	return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(data: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyBytes = hexToBytes(secret);
	const keyBuffer = new ArrayBuffer(keyBytes.length);
	new Uint8Array(keyBuffer).set(keyBytes);

	const key = await crypto.subtle.importKey(
		'raw',
		keyBuffer,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	const raw = new Uint8Array(signature);
	let binary = '';
	raw.forEach(byte => {
		binary += String.fromCharCode(byte);
	});
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) {
		throw new Error('Secret must be a valid hex string');
	}

	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}

	return bytes;
}
