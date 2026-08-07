# Witch

Witch is a content management dashboard for a static Hugo site. It publishes
Obsidian notes to a Cloudflare Worker content API (`witch-worker`), which stores
them in R2 and triggers a Pages build. The build (`sync-content.js`) mirrors the
content into a Hugo repo and renders the site.

## Features

- Create new posts and pages from commands, with a full frontmatter template.
- Dashboard view with Posts, Pages, Tags, Site settings, and Media tabs.
- Local-first: notes and `Site/tags/` metadata notes live in the vault; site
  settings live in the plugin data as JSON;
  the worker is only used when you publish or sync.
- Live list of notes in the vault's `Site/` folder, filtered by status and search,
  with status pills, thumbnails, and bulk publish/unpublish.
- Note settings editor: status, section, slug, dates, featured, tags, excerpt,
  feature image, SEO meta/OG/Twitter, canonical URL, code injection.
- Tags with full SEO: descriptions, accent colors, feature images, meta/OG/Twitter,
  canonical URL, visibility, and parent — plus auto-generated archive pages.
- Site settings (in plugin data) for identity, social, homepage, SEO, legal,
  navigation, and site-wide code injection.
- Live build status: the dashboard shows the last build result and opens the
  site, and note rows show "last published" / "edited since publish" and a
  schedule ETA.
- Media library backed by the worker's `images/` API (copy URL / delete).
- Uploads embedded images to Cloudflare R2 with Canvas-based optimization.
- Scheduled notes auto-flip to `published` once their date passes.
- Dev profile publishes to a local worker; prod profile triggers the build hook.

## Requirements

- Obsidian 1.13.0 or newer (desktop or mobile).
- A deployed `witch-worker` content API with an R2 bucket.
- Optional: Cloudflare R2 credentials for image uploads.

## Install (manual)

1. Clone this repo into your vault: `.obsidian/plugins/witch/`.
2. Install dependencies:
```bash
pnpm install
```
3. Build:
```bash
pnpm run build
```
4. In Obsidian, open `Settings -> Community plugins`, then enable `Witch`.

## Commands

| Command | What it does |
| --- | --- |
| `Open content dashboard` | Opens the CMS dashboard view. |
| `Publish current note` | Publishes the active note to the content API. |
| `Create new post` | Scaffolds a new post in the `Site/` folder. |
| `Create new page` | Scaffolds a new page in the `Site/` folder. |
| `Edit note settings` | Opens the frontmatter editor for the active note. |

## Quick setup

1. Open plugin settings -> Connection.
2. Set the worker URL (`https://witch-worker.<your-subdomain>.workers.dev`) and
   the content API token.
3. Pick `dev` to preview locally or `prod` to trigger builds.
4. Set the `Site/` folder and section tags for routing.

## Frontmatter example

```yaml
---
title: My post title
type: post
section: blog
status: published
slug: my-post-title
date: 2026-03-09
published_at: 2026-03-09T10:00:00Z
tags: [blog, ai]
featured: true
feature_image: "![[cover.png]]"
excerpt: Short summary.
author: Your name
meta_title: SEO title
meta_description: SEO description
keywords: [ai, obsidian]
og_title: Social title
og_description: Social description
og_image: https://example.com/og.png
twitter_title: Twitter title
twitter_description: Twitter description
twitter_image: https://example.com/tw.png
canonical_url: https://yourdomain.com/my-post-title
codeinjection_head: <meta name="robots" content="index">
codeinjection_foot: <script>console.log("ready")</script>
---
```

Sections are `blog`, `portfolio`, and `flashcards`. A `page` type routes to
`<slug>/_index.md`; posts route to `<section>/<slug>.md`. Statuses are
`draft`, `published`, and `scheduled` (future `published_at` stays hidden until
its date passes, then the note flips to `published`). Tags written as `#flag`
are internal — excluded from public tags and archives but carried in the built
frontmatter as `internal_tags`.

## Development

```bash
pnpm install
pnpm run dev
pnpm run lint
pnpm run test
pnpm run build
```

### Local vault deploy

```bash
pnpm run deploy -- /path/to/your/vault
```

You can also set `OBSIDIAN_VAULT` or `OBSIDIAN_VAULT_PATH`.

### Dev workflow

Run the worker locally, then point the plugin's dev profile at it:

```bash
cd witch-worker
pnpm run dev   # http://localhost:8787 with CONTENT_API_TOKEN=dev-token
```

After publishing, sync into your Hugo repo and preview:

```bash
node scripts/sync-content.js --url http://localhost:8787 --token dev-token
hugo server -D
```

## Release checklist

1. Update versions in `package.json`, `manifest.json`, and `versions.json`.
2. Run:
```bash
pnpm run release:check
```
3. Create a Git tag matching the manifest version exactly (no `v` prefix).
4. Create a GitHub release with attached `main.js`, `manifest.json`, and `styles.css`.

Automated tagged releases are available via `.github/workflows/release.yml`.

## License

MIT. See `LICENSE`.
