import { Setting } from 'obsidian';

export interface FieldOptions {
	help?: string;
	placeholder?: string;
	type?: 'text' | 'email' | 'url';
	maxLength?: number;
	validate?: (value: string) => string | null;
}

export function addTextField(
	container: HTMLElement,
	label: string,
	value: string,
	options: FieldOptions,
	onChange: (value: string) => void
): void {
	const setting = new Setting(container).setName(label);
	if (options.help) {
		setting.setDesc(options.help);
	}
	const errorEl = setting.descEl.createSpan({ cls: 'witch-field-error', text: '' });
	setting.addText(text => {
		const input = text.inputEl;
		input.type = options.type ?? 'text';
		if (options.placeholder) {
			text.setPlaceholder(options.placeholder);
		}
		if (options.maxLength !== undefined) {
			input.maxLength = options.maxLength;
		}
		text.setValue(value);
		text.onChange(raw => {
			onChange(raw);
			applyFieldState(input, errorEl, options, raw);
		});
	});
}

export function addTextAreaField(
	container: HTMLElement,
	label: string,
	value: string,
	options: FieldOptions,
	onChange: (value: string) => void
): void {
	const setting = new Setting(container).setName(label);
	if (options.help) {
		setting.setDesc(options.help);
	}
	const errorEl = setting.descEl.createSpan({ cls: 'witch-field-error', text: '' });
	setting.addTextArea(text => {
		const input = text.inputEl;
		if (options.placeholder) {
			text.setPlaceholder(options.placeholder);
		}
		if (options.maxLength !== undefined) {
			input.maxLength = options.maxLength;
		}
		text.setValue(value);
		text.onChange(raw => {
			onChange(raw);
			applyFieldState(input, errorEl, options, raw);
		});
	});
}

export function addInlineTextField(
	setting: Setting,
	value: string,
	options: FieldOptions,
	onChange: (value: string) => void
): void {
	setting.addText(text => {
		const input = text.inputEl;
		if (options.maxLength !== undefined) {
			input.maxLength = options.maxLength;
		}
		if (options.placeholder) {
			text.setPlaceholder(options.placeholder);
		}
		text.setValue(value);
		text.onChange(raw => {
			onChange(raw);
			const error = options.validate ? options.validate(raw) : null;
			const invalid = error !== null && raw.length > 0;
			input.toggleClass('is-invalid', invalid);
			input.setAttr('aria-invalid', invalid ? 'true' : 'false');
			input.setAttr('title', invalid && error ? error : '');
		});
	});
}

export function addDropdownField(
	container: HTMLElement,
	label: string,
	value: string,
	options: Record<string, string>,
	onChange: (value: string) => void
): void {
	new Setting(container)
		.setName(label)
		.addDropdown(dropdown => {
			for (const [key, text] of Object.entries(options)) {
				dropdown.addOption(key, text);
			}
			dropdown.setValue(value);
			dropdown.onChange(onChange);
		});
}

export function addToggleField(
	container: HTMLElement,
	label: string,
	value: boolean,
	help: string,
	onChange: (value: boolean) => void
): void {
	new Setting(container)
		.setName(label)
		.setDesc(help)
		.addToggle(toggle => {
			toggle.setValue(value);
			toggle.onChange(onChange);
		});
}

function applyFieldState(input: HTMLElement, errorEl: HTMLElement, options: FieldOptions, value: string): void {
	const error = options.validate ? options.validate(value) : null;
	const invalid = error !== null && value.length > 0;
	input.toggleClass('is-invalid', invalid);
	input.setAttr('aria-invalid', invalid ? 'true' : 'false');
	if (invalid) {
		errorEl.setText(error ?? '');
		errorEl.toggleClass('witch-field-error-visible', true);
	} else {
		errorEl.setText('');
		errorEl.toggleClass('witch-field-error-visible', false);
	}
}
