# AGENTS.md — Instructions for AI agents working on Witch

## Project overview

Witch is an Obsidian plugin that publishes notes to Ghost CMS with R2 image upload.

- **Language**: TypeScript (ES2022)
- **Build**: esbuild (CJS bundle → `main.js`)
- **Package manager**: pnpm
- **Test runner**: Node built-in `node:test` + `tsx`
- **Lint**: ESLint 9 with `eslint-plugin-obsidianmd`

## Commands

```bash
pnpm run dev          # Watch-mode build
pnpm run typecheck    # TypeScript type-check (tsc --noEmit)
pnpm run build        # typecheck + production build
pnpm run test         # Run all tests (tsx --test test/**/*.test.ts)
pnpm run lint         # ESLint check
pnpm run lint:fix     # ESLint auto-fix
pnpm run release:check # lint + test + build (pre-release gate)
pnpm run version      # Bump version in manifest.json + versions.json
node deploy.mjs /path/to/vault # Build + deploy to vault
```

## Key conventions

### Code structure

```
main.ts                        — Plugin entry point
src/
  services/
    ghost-api.ts               — Ghost Admin API client
    r2-storage.ts              — Cloudflare R2 S3 client + image processing
    post-builder.ts            — Assembles GhostPost payload
    markdown-processor.ts      — Markdown → Ghost HTML conversion
  settings/
    tab.ts                     — Settings UI (tabbed interface)
  types/
    settings.ts                — WitchSettings + DEFAULT_SETTINGS
    ghost.ts                   — PostMetadata, GhostPost interfaces
  utils/
    frontmatter-parser.ts      — YAML frontmatter → PostMetadata
    file-resolver.ts           — Resolve Obsidian file references
    media.ts                   — Image extension/MIME helpers
    jwt.ts                     — Ghost Admin JWT generation
    image-optimizer.ts         — Canvas-based WebP/JPEG/PNG conversion
test/
  frontmatter-parser.test.ts
  post-builder.test.ts
  media.test.ts
```

### Architecture rules

1. **Services receive deps via constructor** — no global imports. Services take `App` and/or `WitchSettings`.
2. **Settings access** — always through `plugin.settings`. Reload with `saveSettings()` after mutation.
3. **Ghost API version** — `Accept-Version: v6.0`. Change to `v5.0` for Ghost 5.x.
4. **Image pipeline** — `r2-storage.ts` calls `optimizeImage()` for Canvas-based conversion. No native Node.js image libs.
5. **Status priority** — frontmatter `status` > settings `defaultStatus` > `'draft'`.
6. **Error handling** — API errors show notices. Debug logging behind `settings.debugMode`. Images that fail upload skip gracefully (use original path).

### Obsidian compliance (must keep)

- `import { requestUrl }` not `fetch()` (rule 24)
- Styles in `styles.css` not injected via JS (rule 34)
- Section headings use `setHeading()` not `createEl('h3')` (rule 17)
- Settings UI text in sentence case (rule 11)
- No console.log in onload/onunload (rule 25)
- `Plugin` settings property should be initialized: `settings: WitchSettings = DEFAULT_SETTINGS`
- Use `registerEvent`, `addCommand`, `addSettingTab` for lifecycle

### Testing

- Tests use `node:test` + `node:assert/strict`
- Run with `tsx --test`
- Place tests in `test/` with `.test.ts` extension

### Publishing flow

1. Bump version in `package.json` + `manifest.json`
2. `pnpm run release:check` (lint + test + build)
3. Tag release in git, push to GitHub
4. GitHub Actions builds and creates release (if workflow exists)

## Common gotchas

- `Uint8Array` is generic in TS 5.x — use `Uint8Array<ArrayBufferLike>` for flexible buffer types
- Do NOT add `sharp` or any native Node.js modules — they don't work in Electron
- Image processing uses `OffscreenCanvas` with `document.createElement('canvas')` fallback
- Frontmatter status/visibility is case-insensitive: `Published` works same as `published`
- The `src/constants.ts` file is empty and unused — can be removed or repurposed
