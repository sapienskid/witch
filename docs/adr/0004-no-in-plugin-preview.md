# 0004 — No in-plugin preview; the site repository never lives in the vault

The plugin deliberately ships no HTML preview and never pulls the site's
repository into the vault. Doing so would couple the plugin to a specific theme
and bloat the bundle and vault. Obsidian is the editor; preview happens in the
terminal with the existing dev flow (`sync-content.js` against the local worker
followed by `hugo server`).

A future preview must not vendor the site — it would have to stream from an
external build (e.g. a preview deployment URL), not render the theme locally.
