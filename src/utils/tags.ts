export function isInternalTag(tag: string): boolean {
	return tag.trim().startsWith('#');
}

export function internalTagName(tag: string): string {
	return tag.trim().replace(/^#+/, '').trim();
}
