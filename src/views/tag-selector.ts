import { AbstractInputSuggest, App } from 'obsidian';

export class TagSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		inputEl: HTMLInputElement,
		private readonly getTags: () => string[]
	) {
		super(app, inputEl);
		this.limit = 20;
	}

	getSuggestions(query: string): string[] {
		const tags = this.getTags();
		const q = query.toLowerCase().trim();
		if (!q) {
			return tags.slice(0, 20);
		}
		return tags.filter(tag => tag.toLowerCase().includes(q)).slice(0, 20);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}
}

export function existingTagNames(app: App): string[] {
	const all = (app.metadataCache as unknown as { getTags(): Record<string, number> }).getTags();
	return Object.keys(all)
		.map(key => key.replace(/^#/, ''))
		.filter(name => name.length > 0)
		.sort((a, b) => a.localeCompare(b));
}

export interface TagSelectorOptions {
	tags: string[];
	availableTags: () => string[];
	onChange: (tags: string[]) => void;
}

export function createTagSelector(container: HTMLElement, app: App, options: TagSelectorOptions): void {
	let selected = [...options.tags];

	const root = container.createDiv({ cls: 'witch-tag-selector' });
	const chips = root.createDiv({ cls: 'witch-tag-chips' });
	const input = root.createEl('input', { type: 'text', placeholder: 'Select existing tags…', cls: 'witch-search' });
	input.setAttr('aria-label', 'Select existing tags');

	const renderChips = (): void => {
		chips.empty();
		for (const tag of selected) {
			const chip = chips.createSpan({ cls: 'witch-tag-chip', text: tag });
			const remove = chip.createEl('button', { cls: 'witch-tag-remove', attr: { 'aria-label': `Remove ${tag}` } });
			remove.setText('×');
			remove.addEventListener('click', () => {
				selected = selected.filter(item => item !== tag);
				options.onChange(selected);
				renderChips();
			});
		}
	};

	const addTag = (value: string): void => {
		const tag = value.trim();
		if (!tag || selected.includes(tag)) {
			return;
		}
		selected = [...selected, tag];
		options.onChange(selected);
		input.value = '';
		renderChips();
	};

	const suggest = new TagSuggest(app, input, options.availableTags);
	suggest.onSelect(value => addTag(value));
	input.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			const value = input.value.trim();
			if (value && options.availableTags().includes(value)) {
				event.preventDefault();
				addTag(value);
			}
		}
	});

	renderChips();
}
