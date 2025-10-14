# Witch - Ghost Publisher for Obsidian

Witch publishes Obsidian notes straight to Ghost with smart frontmatter parsing, automatic markdown cleanup, and optional Cloudflare R2 image hosting.

## Highlights

- Direct publishing to Ghost Admin API with automatic update of existing posts
- Full YAML frontmatter control for Ghost metadata, scheduling, SEO, and social cards
- Dedicated command to upload embedded images to Cloudflare R2 and rewrite note content
- Smart conversion of Obsidian wikilinks and note embeds to publish-ready HTML
- Comprehensive settings UI with diagnostics for Ghost and R2 connections

## Installation

1. Download or clone this repository into `.obsidian/plugins/witch/`
2. Run `npm install`
3. Build the plugin with `npm run build`
4. Reload Obsidian and enable **Witch** from *Settings → Community Plugins*

## Prerequisites

### Ghost Admin API
1. Open Ghost Admin → Integrations → **Add custom integration**
2. Copy the Admin API key (`keyId:secret`) and site URL (no trailing slash)

### Cloudflare R2 (optional)
1. Create an R2 bucket in the Cloudflare dashboard
2. Generate an API token with **Object Read & Write** permissions
3. Note the Account ID, Access Key ID, Secret Access Key, and bucket name

## Commands

| Command | Description |
| --- | --- |
| `Publish current note to Ghost` | Publish or update the active file on Ghost |
| `Upload embedded images to R2 and replace in note` | Upload local images to R2 and swap links inside the note |

Access all commands from the ribbon icon or the command palette.

## Configuration Overview

### Ghost setup
- **Ghost Site URL** – e.g. `https://yourblog.com`
- **Admin API Key** – the `keyId:secret` pair from Ghost
- **Test Connection** – verifies credentials immediately

### Publishing defaults
- **Default Status** – draft, published, or scheduled
- **Default Author(s)** – comma-separated emails or slugs applied globally
- **Default Tags** – comma-separated tags applied to every publish


### Content processing
- **Convert Obsidian links** – rewrites `[[wikilinks]]` to standard links
- **Add source link** – appends an automatic “Published from Obsidian” footer

### Cloudflare R2
- Enable uploads, supply credentials, and test the connection in-app
- Configure optional custom domains and image path prefixes

### Advanced
- **Debug mode** – surfaces verbose logs in the developer console for troubleshooting

## Frontmatter Reference

```yaml
---
title: My Amazing Blog Post
status: published      # draft | published | scheduled
slug: amazing-blog-post
tags: [technology, ai, future]
featured: true
feature_image: https://example.com/hero.jpg
excerpt: A quick summary for readers and search engines.
visibility: public     # public | members | paid
published_at: 2025-10-15T10:00:00Z
meta_title: SEO Title
meta_description: SEO description goes here.
og_title: Open Graph Title
og_description: Open Graph description.
og_image: https://example.com/og.jpg
twitter_title: Twitter Title
twitter_description: Twitter description.
twitter_image: https://example.com/twitter.jpg
custom_excerpt: Custom excerpt rendered on Ghost.
codeinjection_head: <script>...</script>
codeinjection_foot: <script>...</script>
---

Note content…
```

> Author assignments come from **Settings → Publishing → Default author(s)**. Supply comma-separated emails or slugs.

## Markdown & Media Conversion

- `[[Note Name]]` → `[Note Name](/note-name)`
- `[[Note Name|Display]]` → `[Display](/note-name)`
- Embedded notes (`![[Other Note]]`) are inlined into the exported HTML
- Embedded images (`![[image.png]]` or standard markdown images) are optionally uploaded to R2

Supported upload formats: jpg, jpeg, png, gif, webp, svg, bmp, tiff, tif, ico.

## R2 Workflow

1. Enable R2 upload and provide credentials
2. Use the dedicated command to upload embeds in-place, or publish directly and let Witch upload automatically
3. URLs are rewritten to either your custom domain or `https://<bucket>.<account>.r2.dev/<path>`

## Development

```bash
npm install        # install dependencies
npm run dev        # bundle in watch mode for local testing
npm run build      # type-check and produce main.js for release
```

The codebase is now modular: services live in `src/services`, shared helpers in `src/utils`, and all type definitions in `src/types`. This layout simplifies future contributions and testing.

## Troubleshooting

| Symptom | Suggested fix |
| --- | --- |
| Authentication or 401 errors | Re-check Ghost Admin API key and site URL formatting |
| Validation 422 errors | Inspect the notice details and verify frontmatter fields |
| Images not uploading | Use **Test R2 Connection** and confirm bucket permissions |
| Links still show `[[wikilinks]]` | Enable “Convert Obsidian links” in settings |

Enable **Debug mode** for verbose console logs when diagnosing issues.

## Contributing & License

Issues and feature requests are welcome via GitHub. Licensed under MIT – see `LICENSE` for details.

- Built by Sapienskid
