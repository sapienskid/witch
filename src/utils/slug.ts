export function generateSlug(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function splitTags(value?: string): string[] {
	if (!value) {
		return [];
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return [];
	}
	const normalized = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
	return normalized
		.split(',')
		.map(tag => tag.trim())
		.filter(tag => tag.length > 0);
}
