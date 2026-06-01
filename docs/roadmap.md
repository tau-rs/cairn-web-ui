# Cairn Web UI — Roadmap

**Date:** 2026-06-01
**Status:** living document

This is the decomposition and ordering plan for `tau-rs/cairn-web-ui`, the
web-tech UI for [Cairn](https://github.com/tau-rs/cairn). Each phase gets its
own `spec → plan → build` cycle, mirroring how the engine repo was built
(walking skeleton first, everything else a proven seam).

## Context

Cairn's Rust engine is a transport-blind hexagon exposing one async contract:
**commands** (mutations), **queries** (reads), and a push **event stream**.
The generated TypeScript bindings at `tau-rs/cairn/crates/cairn-contract/bindings/`
are the source of truth this UI imports.

**The engine "gap":** nothing currently *serves* the contract — the CLI calls
`Engine` methods directly. A real transport needs (1) a `dispatch(Command)` /
`query(Query)` over the engine, (2) `From<cairn_app::Event> for
cairn_contract::Event`, and (3) query-response DTOs (`get_note` → contents,
`search` → list, `backlinks` → list), which don't exist yet. This is engine-repo
work. It does **not** block UI development because Phases 0–1 build against a
mock client.

## Locked decisions

- **Transport target: Tauri-first.** The engine runs in-process behind Tauri
  IPC — the spec's *primary shell*: offline-first desktop, the everyday personal
  note-taking experience. The daemon (HTTP/WS, for browser/remote/multi-device)
  is a genuinely-secondary later add-on.
- **Design for both modes.** The UI is written against a single
  transport-abstracted `CairnClient` interface with swappable implementations
  (`MockClient`, `TauriClient`, `DaemonClient`). The React app never knows which
  transport it is on; transport is a single composition-root choice. Supporting
  both Tauri and daemon is therefore a design property, not extra work.
- **Engine-gap ownership: decided at Phase 2.** Deferred; does not block
  Phases 0–1.

## Proposed stack (mirrors `tau-rs`/tau-web-ui)

React 18 + Vite + TypeScript + Tailwind 3 + Zustand + react-router-dom,
`@xyflow/react` for the graph view, Vitest + Testing Library for unit/component
tests, Playwright for e2e. pnpm. Tauri v2 added at Phase 2.

## The `CairnClient` seam

```ts
interface CairnClient {
  sendCommand(c: Command): Promise<CommandResult>;
  runQuery(q: Query): Promise<QueryResult>;
  subscribe(cb: (e: Event) => void): Unsubscribe;
}
```

Implementations:
- `MockClient` — in-browser fake over a fixture cairn (Phases 0–1, dev/test).
- `TauriClient` — Tauri IPC + event channel (Phase 2, wired first).
- `DaemonClient` — `fetch` + WebSocket (later, zero UI changes).

## Phases

| Phase | What | Depends on | Where |
|---|---|---|---|
| **0 — Scaffold** | Vite + React + TS + Tailwind + Zustand app. Vendor the contract TS types. Define the `CairnClient` interface + `MockClient` + a fixture cairn. CI. | — | this repo |
| **1 — Walking-skeleton UI** | Vertical slice on the mock: open a cairn, note list, open/edit a markdown note, search, backlinks panel, commit button, live refresh from the event stream. | 0 | this repo |
| **2 — Real transport** | Close the engine gap (dispatcher + `From<app::Event>` + response DTOs) and add the `TauriClient` + Tauri v2 shell. Swap the mock for real notes. | 1 + engine gap | this repo + `tau-rs/cairn` |
| **3 — Editor depth** | CodeMirror 6: live `[[wikilink]]` autocomplete, preview, frontmatter. | 1 | this repo |
| **4 — Graph view** | `@xyflow/react` graph of notes / links / backlinks. | 1 | this repo |
| **5 — Shell polish** | Command palette, panes/tabs, themes, settings. | 1 | this repo |
| **6 — UI-plugin host** | Host the JS/TS UI-plugin API surface defined in engine spec §7. | 3–5 | this repo |
| **7 — Tau actions** | Surface `AgentRuntime` actions (summarize, find-related, …) once tau firms up. | 2 | this repo + engine |

**Critical path:** 0 → 1 → 2. Phases 3–7 fan out from the skeleton and can
reorder freely.

## Deferred decisions

- Engine-gap ownership (revisit at Phase 2).
- Daemon transport + `AuthPolicy` defaults (its own later sub-project).
- Whether mobile (Tauri v2) is in scope and when.
- Codegen tooling for the real transport (`ts-rs` as-is vs `tauri-specta`/`rspc`
  to generate command wiring too).
