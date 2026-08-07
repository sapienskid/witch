# 0001 — The vault is the source of truth; the content store is a generated projection

Witch treats the Obsidian vault as the authoritative write model for all
content — notes, tag metadata, and site configuration are vault files. The
witch-worker/R2 store is a read model: a generated projection (Hugo-ready
content files, `tags.json`, `site.json`) that the site build consumes. The
plugin never round-trips edits from the store back into the vault; it only
uploads projections and, where a decision must be reflected in the vault
(status reconciliation), rewrites the note's frontmatter directly.

This avoids a database and keeps the authoring model plain files, but it means
the remote is disposable — it can be rebuilt from the vault at any time, and
"delete the store" is a supported operation.
