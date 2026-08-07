# AGENTS.md — Instructions for AI agents working on Witch

## Project overview

Witch is an Obsidian plugin that acts as a CMS for a static Hugo site. It
publishes vault notes to a Cloudflare Worker content API (`witch-worker`), which
stores content in R2 and triggers a Cloudflare Pages build.

- **Language**: TypeScript (ES2022)
- **Build**: esbuild (CJS bundle → `main.js`)
- **Package manager**: pnpm
- **Test runner**: Node built-in `node:test` + `tsx`
- **Lint**: ESLint 9 with `eslint-plugin-obsidianmd` (recommendedWithLocalesEn)

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
    content-api.ts             — witch-worker client (requestUrl, injectable requester)
    s3-client.ts               — hand-rolled SigV4 S3/R2 client (no AWS SDK)
    file-store.ts              — vault text read/write/delete/list (injectable FileStore)
    note-factory.ts            — scaffold notes (new post/page template)
    site-content.ts            — pure note → Hugo content mapping (testable)
    site-builder.ts            — vault/R2 wrapper around site-content
    markdown-processor.ts      — resolve links/embeds, upload images to R2 (markdown out)
    tag-manager.ts             — per-tag notes (Site/tags/*.md) + union/archive logic
    tag-note.ts                — pure tag-note frontmatter parse/serialize
    site-settings.ts           — site settings stored in plugin data (JSON)
    site-json.ts               — site.json serialization (strips authoring)
    site-notes.ts              — scan Site/ notes
    publisher.ts               — publish/unpublish/tags/site sync, status reconciliation
    r2-storage.ts              — Cloudflare R2 S3 client + image processing
  settings/
    tab.ts                     — declarative settings (getSettingDefinitions)
  views/
    dashboard.ts               — ItemView dashboard (Posts/Pages/Tags/Site/Media)
    fields.ts                  — shared validated field builders
    modals.ts                  — NewNote/NoteSettings/TagEditor modals
    tag-selector.ts            — selectable tags from existing Obsidian tags
  types/
    settings.ts                — WitchSettings + DEFAULT_SETTINGS
    content.ts                 — ContentMetadata, PublishedContent, SiteSettings, tags
  utils/
    frontmatter-parser.ts      — typed YAML frontmatter parsing
    file-resolver.ts           — resolve Obsidian file references
    media.ts                   — image extension/MIME helpers
    media-url.ts               — public R2 URL builder
    slug.ts                    — generateSlug + splitTags
    tags.ts                    — internal-tag detection
    yaml.ts                    — minimal YAML subset parse/stringify (no js-yaml)
    validate.ts                — field validators (email/url/color/length/slug)
    image-optimizer.ts         — Canvas-based WebP/JPEG/PNG conversion
test/
  frontmatter-parser.test.ts
  site-content.test.ts
  site-json.test.ts
  content-api.test.ts
  tag-manager.test.ts
  note-factory.test.ts
  slug.test.ts
  validate.test.ts
  media.test.ts
```

### Architecture rules

1. **Local-first CMS.** The dashboard manages notes, `Site/tags/`, and
   `Site/`, site settings in plugin data). The content API is only involved at
   publish/sync time (upload + build trigger). No dashboard tab depends on the
   worker to function.
2. **Services receive deps via constructor** — no global imports. Services take
   `App` and/or `WitchSettings`.
3. **Settings access** — always through `plugin.settings`. Reload with
   `saveSettings()` after mutation.
4. **Pure logic is testable** — keep the note→content mapping in
   `site-content.ts` (no Obsidian imports); vault/network I/O lives behind
   injectable interfaces (`FileStore`, `ContentApi`).
5. **Content API is injectable** — `ContentApiClient` takes a `ContentRequest`
   so tests can fake the network without loading the `obsidian` module.
6. **Image pipeline** — `r2-storage.ts` calls `optimizeImage()` for
   Canvas-based conversion. No native Node.js image libs.
7. **Status priority** — frontmatter `status` > settings `defaultStatus` >
   `'draft'`. Draft notes are never uploaded; scheduled notes upload and the
   sync script marks them `draft: true` until `published_at` passes.
8. **Error handling** — API errors show notices. Debug logging behind
   `settings.debugMode`. Images that fail upload skip gracefully.

### Obsidian compliance (must keep)

- `import { requestUrl }` not `fetch()` (rule 24); inject the requester in tests.
- Styles in `styles.css` not injected via JS (rule 34), using Obsidian CSS
  variables, scoped to `.view-type-witch-cms`.
- Section headings use `setHeading()`; the settings tab uses the declarative
  `getSettingDefinitions()` API (Obsidian 1.13+).
- Settings UI text in sentence case (rule 11).
- No console.log in onload/onunload (rule 25).
- `Plugin` settings property should be initialized: `settings: WitchSettings = DEFAULT_SETTINGS`
- Use `registerEvent`, `addCommand`, `addSettingTab` for lifecycle; return views
  directly from `registerView` (don't store them).
- No regex lookbehind (iOS compat), no `document.createElement` (use `createEl`).

### Testing

- Tests use `node:test` + `node:assert/strict`, run with `tsx --test`.
- Test files only import modules without a top-level `obsidian` import
  (`site-content`, `content-api` with a fake requester, `tag-manager` with a
  fake `FileStore`, `tag-note`, `frontmatter-parser`, `slug`, `media`).

### Publishing flow

1. Bump version in `package.json`, `manifest.json`, `versions.json`.
2. `pnpm run release:check` (lint + test + build).
3. Tag release in git, push to GitHub.
4. GitHub Actions builds and creates release (if workflow exists).

## Common gotchas

- `Uint8Array` is generic in TS 5.x — use `Uint8Array<ArrayBufferLike>` for flexible buffer types.
- Do NOT add `sharp` or any native Node.js modules — they don't work in Electron.
- Image processing uses `OffscreenCanvas` with `document.createElement('canvas')` fallback — actually use `createEl('canvas')` for the fallback (lint-clean).
- Frontmatter status is case-insensitive: `Published` works same as `published`.
- `js-yaml` is gone. `src/utils/yaml.ts` parses/serializes only the flat YAML
  subset the plugin needs (scalars, `[a, b]` arrays, `- item` lists, quotes,
  `|` block scalars); it throws on unclosed arrays/quotes.
- `@aws-sdk/client-s3` is gone. `src/services/s3-client.ts` signs R2 requests
  with AWS Signature V4 via `crypto.subtle`; `r2-storage.ts` builds the client
  with `obsidianS3Request`.
- The `obsidian` npm package has no runtime module — never import it in code
  that runs under `tsx` tests.
