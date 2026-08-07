const QUOTED_VALUE_RE = /^[A-Za-z0-9_][A-Za-z0-9 _./+-]*$/;
const KEYWORDS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off']);

export function parseYaml(text: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = text.split(/\r?\n/);
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		i++;
		const stripped = stripComment(line).trimEnd();
		if (stripped.trim() === '' || stripped.trimStart().startsWith('#')) {
			continue;
		}
		const indent = stripped.search(/\S/);
		if (indent > 0) {
			continue;
		}
		const colon = findKeyColon(stripped);
		if (colon === -1) {
			continue;
		}
		const key = stripped.slice(0, colon).trim();
		const rawValue = stripped.slice(colon + 1).trim();
		if (!key) {
			continue;
		}

		if (rawValue !== '') {
			if (isBlockScalar(rawValue)) {
				const block = collectBlock(lines, i, indent + 1);
				i = block.nextIndex;
				result[key] = rawValue[0] === '>' ? block.value.replace(/\n/g, ' ') : rawValue.endsWith('-') ? block.value.replace(/\n$/, '') : block.value;
			} else {
				result[key] = parseValue(rawValue);
			}
			continue;
		}

		const next = nextContentLine(lines, i);
		if (next && next.indent > indent && next.text.startsWith('- ')) {
			const items: unknown[] = [];
			while (i < lines.length) {
				const l = lines[i];
				if (l.trim() === '') {
					i++;
					continue;
				}
				const ind = l.search(/\S/);
				if (ind <= indent) {
					break;
				}
				const t = stripComment(l).trim();
				if (t.startsWith('- ')) {
					items.push(parseValue(t.slice(2).trim()));
					i++;
				} else {
					break;
				}
			}
			result[key] = items;
		} else {
			result[key] = null;
		}
	}

	return result;
}

export function stringifyYaml(obj: Record<string, unknown>): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(obj)) {
		lines.push(serializeEntry(key, value, 0));
	}
	return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function serializeEntry(key: string, value: unknown, indent: number): string {
	const pad = ' '.repeat(indent);
	const head = `${pad}${key}:`;
	if (value === null || value === undefined) {
		return `${head} null`;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return `${head} []`;
		}
		if (value.every(item => isScalar(item))) {
			return `${head} [${value.map(serializeScalar).join(', ')}]`;
		}
		const lines = [head];
		for (const item of value) {
			lines.push(`${pad}  - ${serializeScalar(item)}`);
		}
		return lines.join('\n');
	}
	if (typeof value === 'object') {
		const lines = [head];
		for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
			lines.push(serializeEntry(childKey, childValue, indent + 2));
		}
		return lines.join('\n');
	}
	return `${head} ${serializeScalar(value)}`;
}

function serializeScalar(value: unknown): string {
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	if (typeof value === 'number') {
		return String(value);
	}
	const s = String(value);
	if (s === '') {
		return "''";
	}
	if (needsQuotes(s)) {
		return JSON.stringify(s);
	}
	return s;
}

function needsQuotes(value: string): boolean {
	if (QUOTED_VALUE_RE.test(value) && !KEYWORDS.has(value.toLowerCase())) {
		return false;
	}
	return true;
}

function isScalar(value: unknown): boolean {
	return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number';
}

function parseValue(value: string): unknown {
	const v = value.trim();
	if (v.startsWith('[')) {
		if (!v.endsWith(']')) {
			throw new Error('Unclosed array in YAML');
		}
		const inner = v.slice(1, -1).trim();
		if (inner === '') {
			return [];
		}
		return splitList(inner).map(parseScalar);
	}
	return parseScalar(v);
}

function parseScalar(value: string): unknown {
	const v = value.trim();
	if ((v.startsWith('"') || v.startsWith("'")) && !v.endsWith(v[0])) {
		throw new Error('Unclosed quote in YAML');
	}
	if (v === '' || v === '~' || v === 'null') {
		return null;
	}
	if (v === 'true') {
		return true;
	}
	if (v === 'false') {
		return false;
	}
	if (/^-?\d+$/.test(v)) {
		return parseInt(v, 10);
	}
	if (/^-?\d+\.\d+$/.test(v)) {
		return parseFloat(v);
	}
	if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
		return v
			.slice(1, -1)
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, '\\')
			.replace(/\\n/g, '\n');
	}
	if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
		return v.slice(1, -1).replace(/''/g, "'");
	}
	return v;
}

function splitList(value: string): string[] {
	const parts: string[] = [];
	let current = '';
	let quote: string | null = null;
	let depth = 0;
	for (const char of value) {
		if (quote) {
			current += char;
			if (char === quote && current.length > 1 && current[current.length - 2] !== '\\') {
				quote = null;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}
		if (char === '[') {
			depth += 1;
		} else if (char === ']') {
			depth -= 1;
		}
		if (char === ',' && depth === 0) {
			parts.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}
	if (current.trim()) {
		parts.push(current.trim());
	}
	return parts;
}

function findKeyColon(line: string): number {
	let quote: string | null = null;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (quote) {
			if (char === quote) {
				quote = null;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === ':' && (i + 1 >= line.length || line[i + 1] === ' ')) {
			return i;
		}
	}
	return -1;
}

function stripComment(line: string): string {
	let quote: string | null = null;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (quote) {
			if (char === quote) {
				quote = null;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === '#' && (i === 0 || line[i - 1] === ' ')) {
			return line.slice(0, i);
		}
	}
	return line;
}

function isBlockScalar(value: string): boolean {
	return value === '|' || value === '|-' || value === '>' || value === '>-';
}

function collectBlock(lines: string[], startIndex: number, minIndent: number): { value: string; nextIndex: number } {
	const collected: string[] = [];
	let i = startIndex;
	let blockIndent = -1;
	while (i < lines.length) {
		const line = lines[i];
		const indent = line.search(/\S/);
		if (indent === -1) {
			if (blockIndent !== -1) {
				collected.push('');
			}
			i++;
			continue;
		}
		if (indent < minIndent) {
			break;
		}
		if (blockIndent === -1) {
			blockIndent = indent;
		}
		collected.push(line.slice(blockIndent));
		i++;
	}
	while (collected.length > 0 && collected[collected.length - 1] === '') {
		collected.pop();
	}
	return { value: collected.join('\n'), nextIndex: i };
}

function nextContentLine(lines: string[], index: number): { indent: number; text: string } | null {
	for (let i = index; i < lines.length; i++) {
		if (lines[i].trim() === '') {
			continue;
		}
		const indent = lines[i].search(/\S/);
		return { indent, text: stripComment(lines[i]).trim() };
	}
	return null;
}
