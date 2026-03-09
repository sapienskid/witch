# Witch

Witch publishes Obsidian notes to Ghost using the Ghost Admin API, with frontmatter-driven post metadata and optional Cloudflare R2 image uploads.

## Features

- Publish or update the current note in Ghost.
- Parse YAML frontmatter for status, slug, tags, SEO, visibility, and schedule fields.
- Convert Obsidian-style links and embeds into publishable HTML.
- Upload embedded local images to Cloudflare R2 and rewrite note content.
- Test Ghost and R2 connectivity from plugin settings.

## Requirements

- Obsidian (desktop or mobile) with Community Plugins enabled.
- A Ghost site with a custom integration Admin API key (`keyId:secret`).
- Optional: Cloudflare R2 bucket and API credentials.

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
| `Publish current note to Ghost` | Creates or updates a Ghost post from the active note. |
| `Upload embedded images to R2 and replace in note` | Uploads local embeds and replaces them in the note body. |

## Quick setup

1. Open plugin settings.
2. Fill `Ghost site URL` and `Admin API key`.
3. Optional: configure `Cloudflare R2` credentials and image optimization settings.
4. Run `Test connection` buttons before publishing.

## Frontmatter example

```yaml
---
title: My post title
status: published
slug: my-post-title
tags: [obsidian, ghost]
featured: true
excerpt: Short summary.
visibility: public
published_at: 2026-03-09T10:00:00Z
meta_title: SEO title
meta_description: SEO description
---
```

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

### Security note

- Do not commit local plugin data with real API keys.
- Use `data.example.json` as a safe reference for local settings shape.

## Release checklist

1. Update versions in `package.json` and `manifest.json`.
2. Ensure `versions.json` has the matching version key.
3. Run:
```bash
pnpm run release:check
```
4. Create a Git tag matching the manifest version exactly (no `v` prefix).
5. Create a GitHub release with attached `main.js`, `manifest.json`, and `styles.css`.

Automated tagged releases are available via `.github/workflows/release.yml`.

## License

MIT. See `LICENSE`.
