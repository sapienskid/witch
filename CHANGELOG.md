# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-08-07

- Reworked Witch from a Ghost publisher into a CMS for static Hugo sites.
- Content now lives in a Cloudflare Worker/R2 via the `witch-worker` content API
  (`/api/manifest`, `/api/content/:key`, `/api/build`).
- Added a dashboard view (Posts, Pages, Tags, Site settings) with live scanning
  of the vault's `Site/` folder.
- Added `site-builder` (note → Hugo frontmatter), `tag-manager` (tags.json +
  tag archives), `site-settings` (site.json), and a `publisher` orchestrator.
- Replaced the Ghost Admin API, JWT, and HTML markdown pipeline; markdown bodies
  are now published as-is (Hugo renders them).
- Settings now use the declarative settings API (`getSettingDefinitions()`) and
  require Obsidian 1.13.0+.
- Removed the `markdown-it` and `builtin-modules` dependencies.
- Added unit tests for content building, the content API client, tag manager,
  slug generation, and frontmatter parsing.

## [1.2.0] - 2026-03-09

- Added release hardening with lint, tests, and release CI workflow.
- Added unit tests for frontmatter parsing, post building, and media helpers.
- Improved local deploy workflow to use `pnpm`, include `styles.css`, and resolve plugin ID from `manifest.json`.
- Updated project documentation and release checklist in `README.md`.
- Removed tracked local plugin data to avoid committing sensitive credentials.

## [1.1.0] - 2025-10-15

- Added Cloudflare R2 upload support for embedded images.
- Added settings tab improvements and post metadata handling updates.

## [1.0.0] - 2025-10-14

- Initial release
