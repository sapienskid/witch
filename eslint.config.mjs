import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

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
	...obsidianmd.configs.recommendedWithLocalesEn,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: "./tsconfig.json",
				sourceType: "module"
			}
		}
	},
	{
		files: ["test/**/*.ts"],
		rules: {
			"import/no-nodejs-modules": "off",
			"obsidianmd/no-nodejs-modules": "off",
			"@typescript-eslint/no-floating-promises": "off"
		}
	},
	{
		files: ["*.mjs"],
		languageOptions: {
			globals: {
				process: "readonly",
				console: "readonly"
			}
		},
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/rule-custom-message": "off",
			"obsidianmd/hardcoded-config-path": "off"
		}
	}
]);
