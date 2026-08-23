export function convertHighlights(markdown: string): string {
	const protectedPattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
	const parts = markdown.split(protectedPattern);

	return parts
		.map((part, index) => {
			if (index % 2 === 1) {
				return part;
			}
			return part.replace(/(^|[^=])==([^=\r\n]+)==(?!=)/g, '$1<mark>$2</mark>');
		})
		.join('');
}
