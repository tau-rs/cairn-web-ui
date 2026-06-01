# cairn-web-ui

Web-tech UI for [Cairn](https://github.com/tau-rs/cairn) — an open-source,
git-backed, Obsidian-class note app. Part of the [`tau-rs`](https://github.com/tau-rs) org.

Cairn's Rust engine (`tau-rs/cairn`) is a transport-blind hexagon exposing one
async contract — commands, queries, and an event stream. This repo is the
web UI that consumes that contract, designed to run unchanged over an
in-process (Tauri) or networked (daemon) transport.

## Status

Greenfield. Roadmap and architecture are being defined; see `docs/`.

## Platforms

Desktop (macOS / Linux / Windows) is the supported target, built with Tauri v2.
The mobile targets (iOS / Android) are scaffolded so the shell builds and
launches, but **opening a cairn on mobile is not yet wired** — it needs a
mobile-specific file-access story (iOS document picker / security-scoped
bookmarks, Android SAF) and `git2` cross-compilation, which is a follow-up
phase. On mobile the app currently shows the "Open a cairn…" empty state only.

## License

Dual-licensed under MIT OR Apache-2.0, matching the rest of `tau-rs`.
