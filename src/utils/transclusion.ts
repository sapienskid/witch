export interface TransclusionTarget {
	path: string;
	fragment?: string;
	display?: string;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseTransclusionTarget(raw: string): TransclusionTarget {
	const [core, display] = raw.split('|').map(part => part.trim());
	const match = /^(.*?)([#^].*)?$/.exec(core ?? '');
	return {
		path: (match?.[1] ?? core ?? '').trim(),
		fragment: match?.[2],
		display
	};
}

export function headingLevel(line: string): number {
	const match = /^(#{1,6})\s+/.exec(line);
	return match ? match[1].length : 0;
}

export function extractSection(markdown: string, heading: string): string | undefined {
	const normalize = (value: string) => value.replace(/^#{1,6}\s+/, '').trim().replace(/\s+/g, ' ').toLowerCase();
	const target = normalize(heading);
	const lines = markdown.split('\n');
	const start = lines.findIndex(line => headingLevel(line) > 0 && normalize(line) === target);
	if (start < 0) {
		return undefined;
	}
	const level = headingLevel(lines[start]);
	const content: string[] = [];
	for (let index = start + 1; index < lines.length; index++) {
		const nextLevel = headingLevel(lines[index]);
		if (nextLevel > 0 && nextLevel <= level) {
			break;
		}
		content.push(lines[index]);
	}
	return content.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

export function extractBlock(markdown: string, blockId: string): string | undefined {
	const re = new RegExp(`\\^${escapeRegExp(blockId)}\\s*$`);
	const lines = markdown.split('\n');
	const index = lines.findIndex(line => re.test(line.trimEnd()));
	if (index < 0) {
		return undefined;
	}
	return lines[index].replace(re, '').trimEnd();
}
