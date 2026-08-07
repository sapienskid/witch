---
title: How to use the Witch CMS dashboard
type: post
section: blog
status: draft
slug: witch-cms-dashboard
tags: [obsidian, cms, hugo, cloudflare]
featured: false
feature_image: "![[cover.png]]"
excerpt: Publish this note to your static Hugo site through the witch-worker content API.
meta_title: Witch CMS — publishing to a Hugo site
meta_description: Guide to publishing Obsidian notes to a static Hugo site with the Witch CMS plugin.
keywords: [obsidian, cms, hugo, r2]
author: Your Name
---
# Publishing with Witch CMS

This sample note lives in the vault's `Site/` folder. Open the dashboard
(`Open content dashboard`) and press **Publish**, or run
`Publish current note` from the command palette.

## Publishing workflow

1. **Write your content** in Obsidian using regular markdown.
2. **Add images** with `![[image.png]]` — they upload to Cloudflare R2.
3. **Set frontmatter** for status, section, slug, tags, and SEO.
4. **Publish** from the dashboard, the command, or the ribbon.
5. The note lands in `content/<section>/<slug>.md`, and the Pages build runs.

## Image embedding

- `![[screenshot.png]]` — uploads the vault image to R2 and links it.
- `![[assets/diagram.jpg]]` — an image in a subfolder.
- `![[photos/vacation.png]]` — photos from your collection.

When R2 upload is enabled, the plugin finds each image, uploads it, and replaces
the embed with the public R2 URL in the published markdown.

## Statuses

- `draft` — stays local; never uploaded.
- `published` — uploaded and live after the next build.
- `scheduled` — uploaded with a future `published_at`; the sync script keeps it
  hidden (`draft: true`) until the date passes, then a cron-triggered rebuild
  publishes it.

## Frontmatter reference

- `type` — `post` or `page` (pages route to `<slug>/_index.md`).
- `section` — `blog`, `portfolio`, or `flashcards` (also detected from tags).
- `slug` — URL slug; defaults to the title.
- `tags` — content tags; the section tag is used for routing.
- `feature_image` — an `![[embed]]` or an R2 URL.
- SEO fields: `meta_title`, `meta_description`, `og_*`, `twitter_*`, `keywords`.

---

To publish this note, click the Witch icon in the ribbon and press **Publish**.
