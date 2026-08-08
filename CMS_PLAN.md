# Witch CMS — Implementation Plan

Repurpose the Witch Obsidian plugin from a **Ghost publisher** into a
**full-fledged CMS** for the static Hugo site at `pokharelsabin.com.np`.
Ghost is gone; content is stored in a Cloudflare Worker/R2 and rendered by the
site build.

**Canonical contract**: `witch-worker/README.md`
(https://github.com/sapienskid/witch-worker — routes, auth, key layout,
schemas). This file is the source of truth for the API; mirror its schemas here
as TypeScript types.

## Architecture

```
Obsidian vault
  Site/                 # authoring: notes + posts.json (dashboard index)
  .obsidian/plugins/witch/
       │  Witch CMS — dashboard + publish
       │  PUT content (posts/pages/tags/site.json) — Bearer token via requestUrl
       ▼
site-content worker API — a reusable Worker in the **witch-worker** repo
(github.com/sapienskid/witch-worker) — R2 binding, cron
  R2: content/ · images/
       │  POST /api/build → Pages build hook
       ▼
Pages: npm install && node scripts/sync-content.js && hugo --minify  → static
```

## Locked-in decisions

- **Content store**: the `witch-worker` content API (separate repo), R2 binding, workers.dev domain.
- **Trigger**: Pages build hook; cron Worker for scheduled posts.
- **R2**: one bucket, `content/` + `images/` prefixes.
- **Routing**: section = a special tag (`blog`/`portfolio`/`flashcards`).
- **Vault layout**: one `Site/` folder; section/status/tags via frontmatter.
- **JSON layer**: `site.json` (global, incl. nav), `tags.json` (registry),
  `posts.json` (vault-local dashboard index, NOT uploaded).
- **Tag archives**: the plugin writes `content/tags/<slug>.md` (site renders later).
- **Statuses**: draft / published / scheduled (published_at → sync sets draft).
- **SEO per post**: meta title/description, OG, Twitter fields.
- **CMS globals**: identity, social, homepage text, SEO defaults, nav.
- **UI**: dashboard `ItemView` (Posts · Pages · Tags · Site settings) + ribbon + "Publish current note".
- **No preview**: Obsidian is the editor; the dashboard manages metadata/tags/settings
  and publishing only (no HTML preview, no SEO snippet).
- **Git**: not used for content; publishing = upload + build hook.
- **Plugin name**: keep **Witch**.

## API contract (from numrecall)

Base: `https://witch-worker.<your-subdomain>.workers.dev` · auth `Authorization: Bearer <token>`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/manifest` | list content keys |
| GET | `/api/content/:key` | fetch a file |
| PUT | `/api/content/:key` | upsert a file |
| DELETE | `/api/content/:key` | delete a file |
| POST | `/api/build` | trigger Pages build |

Key layout (relative to `content/`):
`blog/<slug>.md`, `portfolio/<slug>.md`, `flashcards/<slug>.md`,
`<slug>/_index.md` (pages), `tags/<slug>.md`, plus top-level `site.json` and
`tags.json`.

The build (`sync-content.js`) mirrors `.md` keys into `content/`, sets
`draft` from `published_at`, and merges `site.json` into `data/config.yaml`.

## Obsidian note frontmatter (authoring)

```yaml
---
title: Post title
type: post            # post | page
section: blog         # blog | portfolio | flashcards (also the #blog tag)
status: draft | published | scheduled
slug: my-post
date: 2026-08-07
published_at: 2026-08-07T10:00:00+05:45
tags: [blog, ai, math]
featured: false
feature_image: "![[cover.png]]"   # or an R2 URL after upload
excerpt: Short summary.
meta_title: SEO title
meta_description: SEO description
og_title: ...
og_description: ...
og_image: ...
twitter_title: ...
twitter_description: ...
twitter_image: ...
keywords: [ai, math]
---
```

### → Published Hugo frontmatter (produced by `site-builder`)

`title, date, lastmod, draft, slug, section, tags, tag_names, excerpt,
feature_image (R2 URL), reading_time, author, meta_title, meta_description,
og_*, twitter_*, keywords, published_at`. Section drives the destination key.

## JSON schemas

### site.json (uploaded; merged into `data/config.yaml`)

```jsonc
{
  "site": { "name", "title", "tagline", "description", "email", "location" },
  "social": { "github": {"url","username"}, "twitter": {...}, "linkedin": {...} },
  "homepage": { "sections": { "featured_work": {...}, "latest_thoughts": {...} } },
  "settings": { "show_reading_time", "show_share_buttons", "posts_per_page", ... },
  "legal": { "copyright_year", "copyright_holder", "privacy_policy_url", "terms_of_service_url" },
  "content": { "blog": {...}, "portfolio": {...}, "flashcards": {...} },
  "pages": { "blog", "portfolio", "about", "contact", "privacy", ... },
  "seo": { "defaults", "content_types", "keywords" },
  "nav": { "main": [...], "footer_content": [...], "footer_resources": [...], "footer_about": [...] }
}
```

### tags.json (registry)

```jsonc
{ "<slug>": { "name", "slug", "description", "color", "feature_image",
              "parent", "visibility", "meta_title", "meta_description" } }
```

### posts.json (vault-local, `Site/posts.json`)

Dashboard index: per post `{ title, section, type, status, slug, date,
published_at, updated_at, tags, contentKey }`. Not uploaded.

## Plugin changes (the build)

### Settings (`src/types/settings.ts`)
- Remove: `ghostSiteUrl`, `adminApiKey`.
- Add: `contentApiUrl`, `contentApiToken`, `buildHookUrl`, `siteFolder` (vault `Site/`),
  `sectionTags` (`["blog","portfolio","flashcards"]`), `profile` (`dev`|`prod`) presets.
- Keep: R2 + image optimization + defaults (`defaultStatus`, `defaultTags`, `defaultAuthor`, `convertObsidianLinks`).

### Services (`src/services/`)
- **`content-api.ts`** (new) — Worker client via `requestUrl`: `getManifest()`,
  `putContent(key, body)`, `getContent(key)`, `deleteContent(key)`, `triggerBuild()`.
- **`site-builder.ts`** (replaces ghost `post-builder`) — note → published Hugo
  content file: frontmatter mapping (above), markdown body (links/images
  resolved), destination key from section/type.
- **`tag-manager.ts`** (new) — tags.json CRUD; emits `content/tags/<slug>.md`.
- **`site-settings.ts`** (new) — site.json read/edit/upload.
- **`publisher.ts`** (new) — orchestrates: build content → upload post + changed
  tags/site.json → `triggerBuild()` (or local sync in dev profile).
- Keep/refactor: `markdown-processor.ts` → resolve `[[links]]` + `![[embeds]]`
  (images → R2) in markdown only; drop HTML rendering and Ghost-card
  post-processing (no preview; the markdown body is published as-is). Keep
  `r2-storage.ts`, `frontmatter-parser.ts` (extend for new fields),
  `file-resolver.ts`, `media.ts`, `image-optimizer.ts`.
- Delete: `ghost-api.ts`, `jwt.ts`, Ghost-shaped `PostBuilder`.

### Dashboard UI (new `ItemView`, e.g. view type `witch-cms`)
- Ribbon icon + command "Open Witch CMS dashboard".
- Tabs:
  - **Posts** — list from vault `Site/` + `posts.json`; filter by status/tag;
    search; actions: Publish, Unpublish, Delete from site, Open note.
  - **Pages** — same for `type: page` notes.
  - **Tags** — table (name, slug, description, color, posts count) + create/edit/
    delete + per-tag SEO; writes `tags.json` + tag files.
  - **Site settings** — edit `site.json` fields (identity, social, homepage, SEO
    defaults, nav) → upload → trigger build.
- Command: **"Publish current note"** (build + upload + trigger).

### Obsidian compliance
Follow `AGENTS.md` + `eslint-plugin-obsidianmd`: `requestUrl` not `fetch`,
`registerView`/`ItemView`, `registerEvent`, sentence case, `styles.css` for
styling, keyboard accessibility, no default hotkeys, desktop guard for any
Node usage (none needed here).

## Dev workflow

- `pnpm run dev` (esbuild watch) → `pnpm run deploy -- <vault>` installs.
- Dev profile: `contentApiUrl = http://localhost:8787`, token `dev-token`.
  After publish in dev, run from numrecall:
  `node scripts/sync-content.js --url http://localhost:8787 --token dev-token`
  then `npm run dev` (hugo server) to preview.
- Prod profile: worker URL + token + build hook.

## Migration (Ghost → Obsidian)

One-off tool (in witch repo, e.g. `tools/migrate-ghost.mjs`): fetch posts via
Ghost Content API, convert HTML → markdown (`turndown`), map frontmatter per the
authoring schema (keep slugs/URLs), output notes into `Site/` for review.
Images: re-upload to R2 or keep existing URLs. Then publish via the dashboard.

## Execution order

1. Settings + profiles; `content-api.ts`.
2. `site-builder.ts` (frontmatter mapping) + `tag-manager.ts` + `site-settings.ts`.
3. `publisher.ts` (upload + trigger build / local sync).
4. Dashboard `ItemView` (Posts/Pages/Tags/Site tabs).
5. Commands/ribbon + `styles.css`.
6. Migration tool → run → review notes.
7. Publish migrated content; verify against local Worker + hugo, then prod.
8. Tests (frontmatter mapping, site-builder, tag-manager, content-api serialization).

## Testing checklist

- [x] `pnpm run lint && pnpm run test && pnpm run build` (release:check) green.
- [x] Unit tests: frontmatter parsing, site-content building, content-api
      client, tag-manager, slug helpers.
- [ ] Publish a note (dev profile) → file appears in `content/blog/` via sync.
- [ ] Draft stays local; scheduled hidden until date passes.
- [ ] Tags registry + tag files upload; site.json merge works.
- [ ] Mobile: no `fetch`, no Node modules, touch targets ≥ 44px.

## Implementation notes (2.0.0)

Deviations from this plan as built:

- **`posts.json` dropped.** The dashboard live-scans the vault `Site/` folder
  instead of maintaining a vault-local index (never stale, no redundant state).
- **Local-first dashboard.** `Site/tags/` metadata notes live in the vault; site
  settings are stored in plugin data as JSON. The worker is only a
  publish/sync target: posts upload their note plus the tag registry/archives;
  tags and site settings sync via explicit "Publish" actions in each tab.
- **Migration tool skipped.** Greenfield content; no Ghost site to migrate.
- **`markdown-it` removed.** Bodies are published as markdown and rendered by
  Hugo; the plugin only resolves links/images.
- **Obsidian 1.13.0+ / declarative settings.** The settings tab uses
  `getSettingDefinitions()`; `minAppVersion` bumped to `1.13.0`.
- **Section tag is a routing tag.** The section tag (`blog`/`portfolio`/
  `flashcards`) is dropped from the published `tags` list; `section` is set in
  frontmatter and drives the destination key.
- **Pure logic separated.** `site-content.ts` holds the testable note→Hugo
  mapping; `site-builder.ts` is the thin vault/R2 wrapper.
- **Ghost-parity content model.** Full SEO per post and per tag (meta/OG/Twitter,
  canonical, code injection, `featured`, `primary_tag`, internal `#`-tags
  (`internal_tags`), a media tab backed by the worker's `images/` API, bulk
  publish/unpublish, and note/tag editor modals.
- **Status reconciliation.** A `scheduled` note flips to `published` (frontmatter
  rewrite) once `published_at` passes; `unpublish` returns the note to `draft`.
- **Tags are notes, not JSON.** Each selected tag is a `Site/tags/<slug>.md`
  note whose frontmatter holds the full metadata (description, accent color,
  feature image, SEO). The plugin reads/writes them via frontmatter; only
  `content/tags/<slug>.md` archives are uploaded. The Tags tab lists only tags
  the user has explicitly added; "New tag" picks from Obsidian's existing tags.
- **Site settings live in plugin data.** Identity, social, homepage, SEO, legal,
  navigation, code injection, and authoring defaults (`default_status`,
  `default_author`, `default_tags`) are stored as JSON in the plugin's
  `data.json`, and the authoring block is excluded from the published
  `site.json`.
- **Bundle optimized.** `@aws-sdk/client-s3` (SigV4 S3 client hand-rolled with
  `crypto.subtle`) and `js-yaml` (minimal YAML subset) were removed; the bundle
  dropped from ~1.5 MB to ~128 KB.
- **Build feedback.** The worker records build results to `meta/build.json`
  (`GET /api/status`); the dashboard shows the last build, opens the site, and
  per-note "last published / edited since publish" and schedule ETA.
- **No profile, no build-hook setting.** Publishing is production-by-default
  (upload + build trigger always, with a graceful notice if the trigger fails).
  The build hook URL lives only as a worker secret; the plugin stores no
  duplicate. Sensitive settings (content API token, R2 keys) render as masked
  password fields.
