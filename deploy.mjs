import { execSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

const vaultPath = process.argv[2] || process.env.OBSIDIAN_VAULT || process.env.OBSIDIAN_VAULT_PATH;

if (!vaultPath) {
	console.error("Vault path missing.");
	console.error("Usage: node deploy.mjs /path/to/vault");
	console.error("Or set OBSIDIAN_VAULT or OBSIDIAN_VAULT_PATH.");
	process.exit(1);
}

if (!existsSync(vaultPath)) {
	console.error(`Vault path does not exist: ${vaultPath}`);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pluginId = manifest.id;
if (!pluginId) {
	console.error("manifest.json is missing the plugin id.");
	process.exit(1);
}

execSync("pnpm run build", { stdio: "inherit" });

const pluginDir = join(vaultPath, ".obsidian", "plugins", pluginId);
mkdirSync(pluginDir, { recursive: true });

const filesToCopy = ["main.js", "manifest.json", "styles.css"];
for (const file of filesToCopy) {
	if (!existsSync(file)) {
		console.warn(`${file} not found, skipping.`);
		continue;
	}
	copyFileSync(file, join(pluginDir, file));
	console.log(`Copied ${file} to ${pluginDir}`);
}

console.log("Plugin deployed successfully. Reload Obsidian to see changes.");
