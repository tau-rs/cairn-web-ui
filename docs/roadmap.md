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

**The engine "gap" — now closed (update 2026-06-01):** the engine session
shipped ADR-0002 (`tau-rs/cairn` @ `079f9f9`): `cairn-service` (a transport-blind
dispatcher — `dispatch_command` / `dispatch_query` / `app_event_to_wire`) and
`cairn-daemon` (HTTP transport). The contract now includes the response DTOs
(`CommandResponse`, `QueryResponse`, `ContractError`, `NoteSummary`, `GraphEdge`)
and `list_notes` / `get_graph` queries. ADR-0002 explicitly assigns Tauri to the
UI session ("the UI session wires Tauri by calling `cairn-service` in-process"),
validating this roadmap. Phases 0–1 still build against a `MockClient` (no
running engine needed); Phase 2 is now pure UI-side wiring, no engine work.

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
- **Engine-gap ownership: resolved — the engine already closed it** (ADR-0002:
  `cairn-service` + `cairn-daemon`). No UI-side engine work remains for Phase 2.

## Proposed stack (mirrors `tau-rs`/tau-web-ui)

React 18 + Vite + TypeScript + Tailwind 3 + Zustand + react-router-dom,
`@xyflow/react` for the graph view, Vitest + Testing Library for unit/component
tests, Playwright for e2e. pnpm. Tauri v2 added at Phase 2.

## The `CairnClient` seam

```ts
interface CairnClient {
  sendCommand(c: Command): Promise<CommandResponse>;  // rejects with ContractError
  runQuery(q: Query): Promise<QueryResponse>;         // rejects with ContractError
  subscribe(cb: (e: Event) => void): Unsubscribe;
}
```

(`CommandResponse` / `QueryResponse` / `ContractError` are the real vendored
contract DTOs from `tau-rs/cairn`, not invented here.)

Implementations:
- `MockClient` — in-browser fake over a fixture cairn (Phases 0–1, dev/test).
- `TauriClient` — Tauri IPC + event channel (Phase 2, wired first).
- `DaemonClient` — `fetch` + WebSocket (later, zero UI changes).

## Phases

| Phase | What | Depends on | Where |
|---|---|---|---|
| **0 — Scaffold** | Vite + React + TS + Tailwind + Zustand app. Vendor the contract TS types. Define the `CairnClient` interface + `MockClient` + a fixture cairn. CI. | — | this repo |
| **1 — Walking-skeleton UI** | Vertical slice on the mock: open a cairn, note list, open/edit a markdown note, search, backlinks panel, commit button, live refresh from the event stream. | 0 | this repo |
| **2 — Real transport** | Add the `TauriClient` (wraps `cairn-service` in-process) + Tauri v2 shell + open-a-cairn picker; swap the mock for real notes. Engine gap already closed (ADR-0002), so this is UI-side only. | 1 | this repo |
| **3 — Editor depth** | CodeMirror 6: live `[[wikilink]]` autocomplete, preview, frontmatter. | 1 | this repo |
| **4 — Graph view** | `@xyflow/react` graph of notes / links / backlinks (engine `get_graph` already available). | 1 | this repo |
| **5 — Shell polish** | Command palette, panes/tabs, themes, settings. | 1 | this repo |
| **6 — UI-plugin host** | Host the JS/TS UI-plugin API surface defined in engine spec §7. | 3–5 | this repo |
| **7 — Tau actions** | Surface `AgentRuntime` actions (summarize, find-related, …) once tau firms up. | 2 | this repo + engine |

**Critical path:** 0 → 1 → 2. Phases 3–7 fan out from the skeleton and can
reorder freely.

## Deferred decisions

- ~~Engine-gap ownership~~ — resolved: the engine closed it (ADR-0002).
- Daemon transport + `AuthPolicy` defaults (`cairn-daemon` exists; wiring a
  `DaemonClient` + auth is its own later sub-project).
- Whether mobile (Tauri v2) is in scope and when.
- Codegen tooling for the real transport (`ts-rs` as-is vs `tauri-specta`/`rspc`
  to generate command wiring too).
