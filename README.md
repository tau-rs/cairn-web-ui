# cairn-web-ui

Web-tech UI for [Cairn](https://github.com/tau-rs/cairn) — an open-source,
git-backed, Obsidian-class note app. Part of the [`tau-rs`](https://github.com/tau-rs) org.

Cairn's Rust engine (`tau-rs/cairn`) is a transport-blind hexagon exposing one
async contract — commands, queries, and an event stream. This repo is the
web UI that consumes that contract, designed to run unchanged over an
in-process (Tauri) or networked (daemon) transport.

## Status

Greenfield. Roadmap and architecture are being defined; see `docs/`.

## License

Dual-licensed under MIT OR Apache-2.0, matching the rest of `tau-rs`.
