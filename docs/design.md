# Witch — Design Document

## Overview

Witch is an Obsidian plugin that publishes notes to Ghost CMS via the Ghost Admin API. It supports YAML frontmatter-driven metadata, automatic image upload to Cloudflare R2 with format conversion, markdown-to-HTML processing, and flashcard rendering.

## Architecture

### Entry Point

`main.ts` — `WitchPlugin` extends `Plugin`. Lifecycle:

- **onload()**: Loads settings, instantiates services, registers ribbon icon, commands, and settings tab.
- **onunload()**: Empty — all resources use `registerEvent` / `addCommand` / `addSettingTab` for automatic cleanup.

### Service Layer (src/services/)

All services receive their dependencies via constructor injection (settings + app where needed).

#### GhostApiClient (`ghost-api.ts`)

HTTP client for the Ghost Admin API v6.0. Uses `requestUrl()` from Obsidian (per rule 24). Responsibilities:

- `findExistingPost(slug)` — GET posts filtered by slug. Returns `GhostPost | null`.
- `createGhostPost(post)` — POST new post with `source=html`. Validates authors before sending.
- `updateGhostPost(id, post)` — PUT updated post with conflict detection via `updated_at`.
- `getTags()` — GET all tags for matching frontmatter tags to existing Ghost tags.
- `getDetailedError(error)` — Parses Ghost API 422 validation errors.
- `cleanPostData(post)` — Strips null/empty fields, validates required title/html, normalizes status/visibility/date fields. Falls back to `'draft'` for invalid status.
- JWT generation delegates to `generateGhostAdminToken()`. Token is HMAC-SHA256 signed, 5-minute expiry.

#### R2StorageService (`r2-storage.ts`)

S3-compatible client for Cloudflare R2 via `@aws-sdk/client-s3`. Responsibilities:

- `processAllImagesInContent(content, file, title, options)` — Scans markdown for `![[embed]]` and `![alt](path)` patterns, resolves local files, uploads to R2. Uses a heading-aware caption system. Processes embeds in reverse order to preserve match indices.
- `uploadToR2(file, title, alt, index)` — Reads binary from vault, applies Canvas-based image optimization (format conversion, resize), uploads to R2 with cache headers, returns public URL.
- `testConnection()` — HEAD bucket request to verify credentials.
- Object key format: `{prefix}/{slugified-title}-{counter}.{ext}`. Public URL uses custom domain or `r2.dev` default.

#### PostBuilder (`post-builder.ts`)

Assembles the `GhostPost` payload from frontmatter metadata and settings. Status resolution: `metadata.status || settings.defaultStatus` (defaults to `'draft'`). Tags merge frontmatter tags + default tags, deduplicated case-insensitively, cross-referenced against existing Ghost tags. Authors are comma-separated emails or name slugs from settings.

#### MarkdownProcessor (`markdown-processor.ts`)

Converts markdown to Ghost-compatible HTML. Processing pipeline:

1. `convertObsidianLinks` — Converts `[[wikilinks]]` to `[display](/slug)` and inlines non-image `![[embeds]]`.
2. `processFlashcards` — Detects `#flashcards` tag, renders basic cards (`--- card ---` / `---` blocks) and cloze deletions (`==c1::text==`) as HTML.
3. `addSourceLink` — Appends vault attribution footer.
4. `md.render()` — MarkdownIt renders to HTML.
5. `postProcessHtmlForGhostCards` — Wraps bare `<img>` in `<figure class="kg-card kg-image-card">`, converts bare links to YouTube/Vimeo `<iframe>` embeds.
6. Fallback `markdownToHtml()` — Regex-based converter if MarkdownIt fails.

### Settings Tab (src/settings/tab.ts)

`WitchSettingTab` extends `PluginSettingTab` with a custom tabbed interface. Five tabs: Ghost Setup, Publishing, Cloudflare R2, Advanced, Guide. Tab navigation created with DOM buttons; content rendered per tab via separate render methods. Section headings use `setHeading()` per Obsidian rule 17. All styles live in `styles.css` per rule 34.

### Types (src/types/)

- **settings.ts** — `WitchSettings` interface with all configuration fields + `DEFAULT_SETTINGS`. Types: `PublishStatus`, `PostVisibility`, `ImageFormat`.
- **ghost.ts** — `PostMetadata` (frontmatter), `GhostPost` (API payload). All optional SEO/OG fields.

### Utilities (src/utils/)

- **frontmatter-parser.ts** — Parses YAML frontmatter via `js-yaml`. Case-insensitive status/visibility matching. Extracts title, slug, tags (array or string), dates, SEO fields, featured flag.
- **file-resolver.ts** — Resolves Obsidian file references by exact path, relative path, extension-appended path, or vault-wide name scan.
- **media.ts** — `isImageExtension()` and `getMimeType()` helpers.
- **jwt.ts** — Generates Ghost Admin API JWT tokens. HMAC-SHA256 via Web Crypto API (`crypto.subtle`). Hex secret decoding.
- **image-optimizer.ts** — Canvas-based image processing (no native deps). Uses `createImageBitmap` + `OffscreenCanvas` (fallback to regular Canvas). Supports WebP/JPEG/PNG conversion and dimension resize.

### Build & Config

- **esbuild.config.mjs** — Builds `main.ts` → `main.js` (CJS bundle). Externalizes Obsidian, CodeMirror, Electron, and Node builtins.
- **eslint.config.mjs** — ESLint with `@eslint/js`, `typescript-eslint`, `eslint-plugin-obsidianmd`. Enforces Obsidian-specific rules (no command in ID/name, no sample code).
- **tsconfig.json** — ES2022 target, DOM + ES2022 libs, strictNullChecks.
- **deploy.mjs** — Builds + copies `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/witch/`.

## Data Flow: Publish Command

1. User clicks ribbon icon or runs command → `publishActiveNote()` → `publishToGhost(file)`.
2. Read raw file content → `parseFrontmatter()` → `{ metadata, markdownContent }`.
3. If R2 enabled: `processAllImagesInContent()` → uploads local images, returns updated markdown.
4. `convertMarkdownToHtml()` → markdown → Ghost-ready HTML.
5. `getTags()` → existing Ghost tags for cross-reference.
6. `prepareGhostPost()` → merges metadata/settings into `GhostPost`.
7. `findExistingPost(slug)` → if exists, `updateGhostPost()`; else `createGhostPost()`.

## Known Limitations

- Ghost API `Accept-Version: v6.0` — adjust to `v5.0` for Ghost 5.x sites.
- `findExistingPost` uses slug filter — slug must match exactly.
- Image optimization uses Canvas API (available in Electron) — some headless environments may fall back gracefully.
- status/visibility fields in frontmatter are case-insensitive after fix.
