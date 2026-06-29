# Graph view → new seam contract: upgrade brief

**STATUS: pre-design brainstorming brief. NOT an approved design.** This document
captures verified current state, the contract delta, and the open design forks so
the next session can finish brainstorming → approve a design → plan → implement. No
implementation decisions are locked here.

**Date:** 2026-06-29
**Author:** handoff from a brainstorming session run in the `tau-rs/cairn` engine
worktree (wrong repo for the work); relocated here.

---

## 1. What this task actually is

The original framing was "build the knowledge-graph visualization UI from scratch."
That is **wrong for this repo** — a mature graph view already ships here. The real
task is to **evolve the existing graph view onto the new engine seam contract** and
apply the research-driven UX changes, working *in place* (not a rewrite, not a
parallel component).

### Existing data flow (verified)

```
store.ts  loadGraph() → runQuery({ type: "get_graph" })          // OLD contract
          state.graph: { nodes: string[], edges: {from,to}[] }   // paths only, no metadata
          state.noteTags via list_notes → Record<path, tags[]>   // tags fetched separately
   │
   ▼  EditorPane.tsx   (route ?view=graph)
   └─ <GraphView nodes edges tagsByNote activePath loading onOpenNote/>
        └─ react-force-graph-2d canvas — ALREADY BUILT:
           • local/global toggle               (DEFAULT = global)
           • local mode = CLIENT-side BFS       (graph/localGraph.ts), depth 1–3 slider
           • degree computed CLIENT-side        (graph/graphData.ts) → node radius
           • color-groups-by-tag panel          (graph/GraphGroupsPanel.tsx, colorGroups.ts)
           • force-settings panel + freeze/pin  (graph/GraphForcesPanel.tsx, forceSettings.ts)
           • hover-neighbor highlight, zoom-dependent labels
```

So ~80% of the task's "table stakes" (focus+context local mode, degree-sizing, tag
color/filter, togglable forces, force-directed layout) **already exists.**

### Files in play

| File | Role |
|---|---|
| `web/src/store/store.ts` | `graph` state + `loadGraph()` + `noteTags`; the query call site |
| `web/src/components/EditorPane.tsx` | renders `<GraphView>` for `?view=graph`, wires store → props |
| `web/src/components/GraphView.tsx` | 340-line canvas component; all rendering + panels |
| `web/src/components/graph/graphData.ts` | builds force-graph data, **computes degree**, node radius, label alpha |
| `web/src/components/graph/localGraph.ts` | **client-side** depth-bounded BFS subgraph |
| `web/src/components/graph/colorGroups.ts` / `GraphGroupsPanel.tsx` | tag→color groups |
| `web/src/components/graph/forceSettings.ts` / `GraphForcesPanel.tsx` | d3-force tuning |
| `web/src/components/graph/forceGraphTypes.ts` | typed seam over react-force-graph mutation |
| `web/src/client/daemon.ts` | `runQuery`; `noteTags()` (list_notes) |
| `web/src/contract/{Query,QueryResponse,GraphEdge}.ts` | **vendored OLD bindings** |

### Layout engine is already decided

`react-force-graph-2d` ^1.29 (canvas, wraps d3-force). The task's "choose a layout
engine / perf ceiling" brainstorm is largely **settled by what's in use** — don't
re-litigate it; design the perf ceiling *around* this engine.

---

## 2. The contract delta

### New contract to consume (frozen by the engine Track-1 seam PR)

```ts
Query  GetGraph { scope: GraphScope }
       GraphScope { focus?: string; depth?: number }   // focus=null ⇒ global; depth default 1
QueryResponse Graph { nodes: GraphNode[]; edges: GraphEdge[] }
       GraphNode { path: string; title: string; degree: number; tags: string[]; mtime_secs: number }
       GraphEdge { from: string; to: string }
// also available, design seams for but don't build yet:
       GetSuggestions → Suggestions { suggestions: SuggestedEdge[] }  // empty until engine Track 2
       GraphAt { revision: string; scope: GraphScope }                // errors Unsupported until Track 3
```

### What changes when we adopt it

| New field / query | Replaces / adds in this repo |
|---|---|
| `GetGraph { scope:{focus,depth} }` | **Server-side** neighborhood → replaces client BFS in `localGraph.ts`. Don't ship the whole graph to the browser to slice depth-1 — this *is* the perf-ceiling strategy. |
| `GraphNode.degree` | Removes client degree computation in `graphData.ts`. |
| `GraphNode.tags[]` | Folds in the separate `noteTags`/`list_notes` fetch; feeds existing `colorGroups`. |
| `GraphNode.title` | Better node labels than `stem(path)`. |
| `GraphNode.mtime_secs` | **New capability** — recency encoding; nothing uses it today. |
| `GetSuggestions` / `GraphAt` | New seams: dashed/distinct suggested edges merged client-side into one visual graph; temporal scrubber. |

### Decisions locked by the engine team (do NOT re-litigate)

- Suggested edges and explicit edges are **separate engine queries**, merged
  **client-side** into ONE visual graph.
- Temporal is a **separate query** (`GraphAt`).

### Research — table stakes / traps (from the task brief)

- **DO** local-first / focus+context (Degree-of-Interest; Perer & van Ham 2009):
  render the focused note's neighborhood via `GetGraph` focus+depth, expandable.
- The **global** graph is the documented "hairball" failure mode, unvalidated above
  ~100 nodes / 200 edges across 152 studies → keep it a **secondary "overview,"
  never the headline.**
- Force-directed with **togglable forces** (already present) + a **hard perf
  ceiling**: org-roam-ui warns >2k nodes degrades; don't naively simulate thousands.
- Use node metadata: size by degree, color/filter by tags, encode recency via
  `mtime_secs`.

---

## 3. Open design forks (to brainstorm + decide — NOT decided here)

1. **Local-vs-global default + transition.**
   Code currently defaults to `global` (`localGraph.ts DEFAULT_LOCAL_GRAPH.enabled =
   false`); research says **local should be default**, global a secondary overview.
   Fork: flip default to local (focus = current note)? How to transition (toggle vs
   click-to-refocus)? What does "global" do at scale (cap / cluster / LOD / warn)?

2. **Server-side scope vs keep client BFS.**
   `GetGraph{focus,depth}` lets the *engine* return the neighborhood. Fork: replace
   `localGraph.ts` with a scoped query (bounded payload, better perf) vs keep client
   BFS as a fallback for offline/global-cached data. Affects `store.ts` shape:
   one `graph` blob vs per-focus fetches + cache.

3. **Perf ceiling for the global overview.** Cap N nodes? Degree-threshold cull?
   Cluster by folder/tag? LOD (hide labels/links when zoomed out — partial already)?
   What's the explicit ceiling and the user-facing message when exceeded?

4. **Filtering & legend UX.** A legend exists implicitly via color-groups; add an
   explicit legend? Filter by tag / recency / degree? Where (existing right-side
   panel vs new)?

5. **How focus is chosen.** Current note (`activePath`) vs clicking a node. Today a
   node click *opens the note* (`onOpenNote`). Fork: click = open vs click = refocus
   neighborhood vs modifier-click split; how focus syncs with the editor.

6. **Recency encoding from `mtime_secs`.** New. Color ramp? Opacity? Halo? Must not
   collide with the tag-color channel — pick a non-conflicting visual channel.

7. **Future-proofing seams (design now, build later).** Suggested edges
   (dashed/distinct, merged client-side) and a temporal scrubber (`GraphAt`) must
   slot in **without a rewrite**. Decide the data-merge shape and the control
   surface placement now.

---

## 4. Blockers & sequencing

- **Implementation is blocked on the engine Track-1 seam landing in `tau-rs/cairn`
  `main`.** As of this writing it is **not merged**: `get_graph` still returns
  `nodes: string[]` and there are no `GraphNode`/`GraphScope` bindings. The seam is
  being built in parallel (sibling tracks: semantic-edges-suggestions = Track 2,
  temporal-graph-at = Track 3).
- **Design is NOT blocked** — brainstorm against the contract above.
- **Re-vendor step (when Track 1 merges):** copy the generated TS bindings from
  `crates/cairn-contract/bindings/` (GraphNode, GraphScope, the updated Query /
  QueryResponse, plus SuggestedEdge / Suggestions for the seam) into
  `web/src/contract/`. Confirm `contractGuards.ts` covers the new response shape.

## 5. Suggested next steps

1. Finish brainstorming forks §3 (one at a time) → get design approval.
2. Replace the STATUS header here with the approved design, commit.
3. `writing-plans` → implementation plan.
4. When Track 1 merges: re-vendor bindings, then implement in place against
   `GraphView.tsx` / `graphData.ts` / `store.ts`.
5. Tests are part of done: Vitest (unit, e.g. `graphData.test.ts`, `localGraph.test.ts`)
   + Playwright (`web/e2e`). Mutation testing (Stryker) is configured.
