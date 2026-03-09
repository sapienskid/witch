import js from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		ignores: [
			"node_modules/**",
			"main.js",
			"package-lock.json",
			"pnpm-lock.yaml",
			".genkit/**"
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["main.ts", "src/**/*.ts", "test/**/*.ts"],
		languageOptions: {
			globals: {
				window: "readonly",
				document: "readonly",
				console: "readonly",
				setTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				TextEncoder: "readonly",
				crypto: "readonly",
				btoa: "readonly"
			}
		},
		plugins: {
			obsidianmd
		},
		rules: {
			"obsidianmd/commands/no-command-in-command-id": "error",
			"obsidianmd/commands/no-command-in-command-name": "error",
			"obsidianmd/commands/no-plugin-name-in-command-name": "error",
			"obsidianmd/no-sample-code": "error",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"no-console": "off"
		}
	},
	{
		files: ["test/**/*.ts"],
		rules: {
			"import/no-nodejs-modules": "off"
		}
	},
	{
		files: ["*.mjs"],
		languageOptions: {
			globals: {
				process: "readonly",
				console: "readonly"
			}
		}
	}
]);
