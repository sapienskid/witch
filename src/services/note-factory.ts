import type { SiteContentType } from '../types/content';
import type { PublishStatus } from '../types/settings';
import { generateSlug } from '../utils/slug';
import { stringifyYaml } from '../utils/yaml';

export interface NoteScaffold {
	title: string;
	type: SiteContentType;
	status: PublishStatus;
	tags: string[];
	author: string;
}

export function noteScaffold(params: NoteScaffold): string {
	const frontmatter: Record<string, unknown> = {
		title: params.title,
		type: params.type,
		status: params.status,
		slug: generateSlug(params.title) || 'untitled',
		date: new Date().toISOString().slice(0, 10),
		featured: false
	};
	if (params.tags.length > 0) {
		frontmatter.tags = params.tags;
	}
	if (params.author) {
		frontmatter.author = params.author;
	}
	const body = `# ${params.title}\n\nWrite your content here.\n`;
	return `---\n${stringifyYaml(frontmatter)}---\n${body}`;
}

export function noteFileName(params: NoteScaffold): string {
	return `${generateSlug(params.title) || 'untitled'}.md`;
}