# 0002 — Local-first: management works offline; publishing is the only remote operation

All authoring and management — creating notes, editing posts and pages,
managing tags and their SEO, editing site configuration — happens against vault
files and works with no network. The content API is touched only when a
publish/sync action is explicitly invoked (publish a note, publish tags,
publish site settings, unpublish, media operations).

This makes the CMS resilient to flaky networks and keeps the dashboard usable
as a pure editor, at the cost of not reflecting remote state (e.g. build
results) inside Obsidian.
