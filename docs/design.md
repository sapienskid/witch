# Witch — Design Document

## Overview

Witch is an Obsidian plugin that acts as a CMS for a static Hugo site. It
publishes vault notes to a Cloudflare Worker content API (`witch-worker`), which
stores content in R2 and triggers a Cloudflare Pages build. The build syncs the
content into a Hugo repo and renders the site. Ghost is gone; Obsidian is the
editor and dashboard.

## Architecture

```
Obsidian vault
  Site/                 # notes + tags/ (tag metadata notes); site settings in plugin data
  .obsidian/plugins/witch/
       │  Witch CMS — dashboard + publish
       │  PUT content (posts/pages/tags/site.json) — Bearer token via requestUrl
       ▼
witch-worker content API — R2 binding, cron
       │  POST /api/build → Pages build hook
       ▼
Pages: node scripts/sync-content.js && hugo --minify → static
```

The CMS is local-first: the dashboard reads and writes everything in the vault
(`Site/` notes, `Site/tags/`). Site settings live in plugin data. The worker is only the
publish/sync target — the Tags and Site settings tabs work fully offline.

### Entry Point

`main.ts` — `WitchPlugin` extends `Plugin`. Lifecycle:

- **onload()**: Loads settings, instantiates services, registers the dashboard
  view, commands, ribbon icon, and settings tab.
- **onunload()**: Empty — all resources use `registerView` / `addCommand` /
  `addSettingTab` for automatic cleanup.

### Service Layer (src/services/)

All services receive dependencies via constructor injection (settings + app
where needed).

#### FileStore (`file-store.ts`)

Injectable `FileStore` (`readText`/`writeText`/`deleteFile`/`listNotes`) backed by
  the Obsidian vault.
`ObsidianFileStore` reads and writes JSON files under the site folder, creating
folders as needed. This keeps `TagManager` and `SiteSettingsService` local and
testable without the `obsidian` module.

#### ContentApiClient (`content-api.ts`)

Transport client for the witch-worker API. Uses `requestUrl()` (rule 24) behind
an injectable `ContentRequest` so tests can fake the network. Exposes
`getManifest`, `getContent`, `putContent`, `deleteContent`, and `triggerBuild`,
all with `Authorization: Bearer <token>`. Only used at publish/sync time.

#### SiteBuilder (`site-builder.ts`) + site-content (`site-content.ts`)

`site-builder.ts` handles vault I/O: reads the note, resolves image embeds via
`markdown-processor`, uploads the feature image to R2, and delegates to the
pure functions in `site-content.ts`.

`site-content.ts` maps a note to published Hugo content:

- Frontmatter: title, date, lastmod, draft, slug, section, tags (slugs),
  tag_names (display names from the registry), excerpt, feature_image (R2 URL),
  reading_time, author, SEO/OG/Twitter fields, keywords, published_at.
- Destination key: posts → `<section>/<slug>.md`, pages → `<slug>/_index.md`.
- Section resolved from frontmatter `section` or a section tag in
  `settings.sectionTags`; the section tag is dropped from the published tags.
- `draft` is true for `draft` status or a future `published_at`.

#### MarkdownProcessor (`markdown-processor.ts`)

Markdown-only output (Hugo renders). Uploads `![[image]]` and `![alt](path)`
embeds to R2 via `r2-storage` (markdown form), inlines non-image `![[embeds]]`,
and converts `[[wikilinks]]` to `[display](/slug)`.

#### TagManager (`tag-manager.ts`)

Local CRUD over `Site/tags/<slug>.md` notes via the `FileStore`. `unionTags` merges tags
derived from notes with registry metadata; internal (`#`) tags are excluded
everywhere. The publisher uploads the registry and generates
`content/tags/<slug>.md` archive pages (with full tag metadata) at sync time.

#### SiteSettingsService (`site-settings.ts`)

Local read/edit/save of site settings in plugin data (identity, social, homepage, SEO,
nav, code injection). The Site tab works fully offline; an explicit publish
action uploads `site.json`.

#### Publisher (`publisher.ts`)

Orchestrates publishing: skips drafts, builds content, uploads the note plus the
tag registry/archives, and triggers a build (prod) or shows the local-sync hint
(dev). `unpublish` deletes the content key and returns the note to `draft`.
`publishTags` and `publishSite` sync the local tag notes and site settings
explicitly. `reconcileNoteStatus` flips a `scheduled` note to `published` once
its date passes.

#### R2StorageService (`r2-storage.ts`)

S3-compatible client for Cloudflare R2 via `@aws-sdk/client-s3`. Uploads images
under `images/` with optional Canvas-based optimization (WebP/JPEG/PNG, resize).
Emits either HTML figures or markdown links depending on `asMarkdown`.

### Dashboard View (src/views/dashboard.ts)

`WitchDashboardView` extends `ItemView` (`witch-cms`). Tabs:

- **Posts / Pages** — live-scan the vault `Site/` folder, filter by status and
  search, show status pills and feature-image thumbnails, and support bulk
  publish/unpublish plus per-note edit.
- **Tags** — union of note tags and the registry, with accent-color swatches,
  a full tag editor (SEO), and archive publishing.
- **Site settings** — edit site settings in plugin data (identity, social, homepage, SEO,
  legal, nav, code injection) locally with auto-save, then publish.
- **Media** — browse the worker's `images/` API, copy URLs, and delete.

Scheduling is edited through the note settings modal; a reconcile loop flips
scheduled notes to `published` once `published_at` passes. The view is created
and returned directly inside `registerView` (rule 7). DOM uses Obsidian helpers
(`createEl`, `Setting`), shared validated field builders (`fields.ts`), real
buttons (keyboard accessible), tooltips with ARIA labels, and styles scoped to
`.view-type-witch-cms`.

### Modals (src/views/modals.ts)

- `NewNoteModal` — scaffolds a post or page from a template.
- `NoteSettingsModal` — full frontmatter editor (general, media, SEO, social,
  advanced), writing via `app.fileManager.processFrontMatter`.
- `TagEditorModal` — full tag editor including all SEO fields.

### Settings Tab (src/settings/tab.ts)

Uses the declarative settings API (`getSettingDefinitions()`), so it is
searchable in Obsidian 1.13+. `getControlValue` / `setControlValue` bridge the
declarative controls to `plugin.settings` and call `saveSettings()`; visibility
predicates show the R2 credential and image optimization fields when enabled.

### Types (src/types/)

- **settings.ts** — `WitchSettings` + `DEFAULT_SETTINGS` (content API,
  site folder, routing tags, publishing defaults, R2 + image optimization).
- **content.ts** — `ContentMetadata`, `PublishedContent`, `SiteSettings`
  (site.json), `TagEntry`/`TagRegistry` (per-tag notes).

### Utilities (src/utils/)

- **frontmatter-parser.ts** — typed YAML frontmatter parsing via `js-yaml`
  (JSON schema, so dates stay strings).
- **slug.ts** — `generateSlug()` and `splitTags()`.
- **file-resolver.ts** — resolves Obsidian file references.
- **media.ts** — image extension/MIME helpers.
- **image-optimizer.ts** — Canvas-based image conversion.

## Data Flow: Publish Command

1. Command / ribbon / dashboard action → `Publisher.publish(file)`.
2. Read note → `parseFrontmatter()` → metadata + body.
3. `TagManager.ensureTags()` updates the tag registry.
4. `SiteBuilder.buildFromFile()` → markdown-processed body + R2 feature image →
   pure `buildContent()` → published file + destination key.
5. `ContentApiClient.putContent(key, content)` uploads to the worker.
6. Prod: `triggerBuild()` → Pages rebuild. Dev: hint to run `sync-content.js`.

## Obsidian Compliance

- `requestUrl` for all network; no `fetch`, no Node modules at runtime.
- `registerView`/`ItemView`, `addCommand`, `addSettingTab` for lifecycle.
- Declarative settings (`getSettingDefinitions()`), sentence-case UI text,
  no manual HTML headings.
- `createEl` helpers, tooltips + ARIA labels, `:focus-visible`, 44px touch
  targets, no regex lookbehind.
- Styles in `styles.css` using Obsidian CSS variables, scoped to the view.

## Known Limitations

- Image optimization uses the Canvas API (available in Electron).
- `feature_image` embeds upload to R2 during publish; the note's frontmatter is
  not rewritten (the original `![[cover.png]]` stays in the vault).
- Declarative settings require Obsidian 1.13.0+.
