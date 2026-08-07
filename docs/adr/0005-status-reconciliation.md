# 0005 — Declared status is reconciled to published when a schedule passes

Because the worker cannot reach into the vault, a note that was scheduled keeps
`status: scheduled` even after its date passes and the post is live. Witch
reconciles the declared status: while the dashboard is open (and on publish) it
rewrites the note's frontmatter `status` to `published` once `published_at` is
in the past. This matches how Ghost surfaces the post after scheduling.

The alternative — deriving an "effective status" in the UI without touching the
note — was considered and rejected in favor of mirroring the reality on disk.
Reconciliation only ever flips `status`; it never edits `published_at` or
`lastmod`, so content history is preserved.
