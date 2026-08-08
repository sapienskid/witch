export function convertCallouts(markdown: string): string {
	return markdown.replace(
		/^> \[!(\w+)\]([^\n]*)\n((?:^>.*\n?)*)/gm,
		(match: string, type: string, titleLine: string, bodyLines: string) => {
			const title = titleLine.trim();
			const body = bodyLines
				.split('\n')
				.map(line => line.replace(/^>\s?/, ''))
				.join('\n')
				.trim();
			const titleAttr = title ? ` title="${title.replace(/"/g, '\\"')}"` : '';
			return `{{< callout type="${type.toLowerCase()}"${titleAttr} >}}\n${body}\n{{< /callout >}}\n`;
		}
	);
}
