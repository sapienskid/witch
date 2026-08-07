# 0003 — Scheduling is a build-time draft flag plus a cron-triggered rebuild

A static site cannot time-serve content, so scheduling is modelled in two
layers: the note declares `status: scheduled` with a future `published_at`, and
the sync build step writes `draft: true` whenever `published_at` is in the
future. A cron trigger on the worker rebuilds periodically, so when the date
passes the next build flips the file to `draft: false` and the post goes live.

The alternative — a server that holds content until a timestamp and injects it
at render time — would reintroduce dynamic serving and is rejected. The trade
off is that a scheduled post only goes live after the next cron tick (up to the
cron interval late).
