const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
	return EMAIL_RE.test(value);
}

export function isValidUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

export function isValidHexColor(value: string): boolean {
	return /^#?[0-9a-fA-F]{3,8}$/.test(value.trim());
}

export function validateEmail(value: string): string | null {
	return value.length > 0 && !isValidEmail(value) ? 'Enter a valid email address' : null;
}

export function validateUrl(value: string): string | null {
	return value.length > 0 && !isValidUrl(value) ? 'Enter a valid http(s) URL' : null;
}

export function validateMaxLength(value: string, max: number): string | null {
	return value.length > max ? `At most ${max} characters` : null;
}

export function validateYear(value: string): string | null {
	return value.length > 0 && !/^\d{4}$/.test(value.trim()) ? 'Use a 4-digit year' : null;
}

export function validateColor(value: string): string | null {
	return value.length > 0 && !isValidHexColor(value) ? 'Use a hex color like #ff5500' : null;
}

export function validateNav(value: string): string | null {
	const bad = value
		.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
		.find(line => !line.includes('|'));
	return bad ? `Line "${bad}" needs "label | /url"` : null;
}

export function validateRequired(value: string, label: string): string | null {
	return value.trim().length === 0 ? `${label} is required` : null;
}

export function validateSlug(value: string): string | null {
	return value.length > 0 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())
		? 'Use lowercase letters, numbers, and dashes'
		: null;
}

export function validateImageKey(key: string): string | null {
	return key.length === 0 || /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key) ? null : 'Invalid file name';
}
