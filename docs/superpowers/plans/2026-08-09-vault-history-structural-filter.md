# Vault-history structural-marker filter — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Structural only" toggle to the vault-history scrubber that swaps its data source to the engine's `structural_revisions` query — showing only commits that changed the link graph (node/edge add/remove).

**Architecture:** UI half of an engine-first feature. The engine already shipped (`tau-rs/cairn` PR #160, main `8abc0ef`): a **separate `structural_revisions { limit }` query** returning `History` — a pre-filtered `Revision[]`, newest-first, **no new field**, tags/frontmatter/body-only excluded. So the client does **no** classification: the toggle just picks which query feeds the scrubber (`structural_revisions` vs `vault_history`). The hook owns the toggle state, a lazy fetch into a parallel store field, persistence, and reset-to-Live-on-toggle. Spec: `docs/superpowers/specs/2026-08-09-vault-history-structural-filter-design.md`.

**Tech Stack:** React + TypeScript, Zustand store, Vitest + Testing Library, ts-rs-generated vendored contract, `just` (pnpm under the hood).

## Global Constraints

- **Engine is DONE** — `tau-rs/cairn` `8abc0ef` (PR #160). No engine work here. Do **not** add a `Revision.structural` field or classify client-side; the engine returns a filtered list.
- **Vendored contract is generated, never hand-edited.** `web/src/contract/*` is raw ts-rs output, in `web/.prettierignore`. Regenerate only via `scripts/sync-contract.sh <engine-path>`; the drift gate `scripts/check-contract-drift.sh` reads the rev from `web/src/contract/source.ts`, re-syncs, and byte-compares.
- **`Revision` is unchanged** (`{ id, message, timestamp_secs, author }`). No test-fixture churn from a field addition.
- **Engine query shape:** `{ type: "structural_revisions", limit: number | null }` → `{ type: "history", revisions: Revision[] }` (same as `vault_history`; `limit: null` = all).
- **Single-branch discipline:** run `scripts/claim-plan.sh vault-history-structural-filter` before executing; if FREE, push the feature branch immediately (empty commit fine) to plant the flag, then record it in `.context/OWNERS.md`.
- **Full gate before any "done" claim:** `just web-ci` = `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` (from `web/`). `format:check` is easy to miss.
- Single test file: `cd web && pnpm test -- <path>`; single case: add `-t "<name>"`.

---

### Task 1: Sync the vendored contract to engine `8abc0ef`

Pull in the `structural_revisions` query by re-vendoring the contract and bumping the engine pin. `Revision` doesn't change, so no fixture churn — but the current vendored rev (`130726e`) is several engine PRs behind `8abc0ef`, so the sync also pulls additive collab wire types (#157–#159). Additive types don't break existing code; verify.

**Files:**
- Modify (generated, via script): `web/src/contract/*` incl. `Query.ts`, `source.ts`.
- Modify: `src-tauri/Cargo.toml` (the six `cairn-*` git `rev`s) + `src-tauri/Cargo.lock`.

**Interfaces:**
- Produces: the `Query` union now includes `{ type: "structural_revisions", limit: number | null }`. Later tasks issue that query.

- [ ] **Step 1: Put a local engine checkout at `8abc0ef`.**

Run:
```bash
git -C /Users/titouanlebocq/code/cairn fetch origin && \
git -C /Users/titouanlebocq/code/cairn checkout 8abc0ef
```
Expected: detached HEAD at `8abc0ef` ("StructuralRevisions query …").

- [ ] **Step 2: Re-vendor the contract.**

Run:
```bash
scripts/sync-contract.sh /Users/titouanlebocq/code/cairn
grep -n structural_revisions web/src/contract/Query.ts
git diff web/src/contract/source.ts
```
Expected: `Query.ts` now has a `structural_revisions` variant; `source.ts` records `8abc0ef…`. Do not hand-edit any vendored file.

- [ ] **Step 3: Bump the engine pin to `8abc0ef`.**

In `src-tauri/Cargo.toml`, change every `cairn-*` dependency `rev` from `057bf5e…` to the full `8abc0ef…` SHA (all six: domain, app, infra, contract, service, ports). Then refresh the lock:
```bash
cd src-tauri && cargo update -p cairn-app -p cairn-contract 2>/dev/null; cd ..
```
(If offline, note it and let CI resolve the lock.)

- [ ] **Step 4: Verify the UI still compiles and passes with the new contract.**

Run: `cd web && pnpm typecheck && pnpm test`
Expected: PASS. (New query variant is additive and as-yet unused; existing tests unchanged.) If a pulled collab type broke a call site, fix that site minimally here.

- [ ] **Step 5: Verify the drift gate.**

Run: `scripts/check-contract-drift.sh`
Expected: "contract in sync with engine @ 8abc0ef…".

- [ ] **Step 6: Commit.**

```bash
git add web/src/contract src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(contract): sync to engine 8abc0ef (structural_revisions query)"
```

---

### Task 2: Persist the structural-only toggle

Load/save helpers for the toggle state, mirroring `loadTemporalOpen`/`saveTemporalOpen`. Pure, testable before any UI.

**Files:**
- Modify: `web/src/components/graph/temporalControls.ts`
- Test: `web/src/components/graph/temporalControls.test.ts`

**Interfaces:**
- Produces: `loadStructuralOnly(): boolean`, `saveStructuralOnly(on: boolean): void`. Key `"cairn.graph.temporal.structuralOnly"`, `"1"`/`"0"`, default `false`, swallow storage errors.

- [ ] **Step 1: Write the failing test.**

```ts
// temporalControls.test.ts
import { loadStructuralOnly, saveStructuralOnly } from "./temporalControls";

describe("structural-only persistence", () => {
  beforeEach(() => localStorage.clear());
  it("defaults to false when unset", () => {
    expect(loadStructuralOnly()).toBe(false);
  });
  it("round-trips true", () => {
    saveStructuralOnly(true);
    expect(loadStructuralOnly()).toBe(true);
    expect(localStorage.getItem("cairn.graph.temporal.structuralOnly")).toBe("1");
  });
  it("round-trips false", () => {
    saveStructuralOnly(false);
    expect(loadStructuralOnly()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/components/graph/temporalControls.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement.**

```ts
// temporalControls.ts — append below saveTemporalOpen
const STRUCTURAL_KEY = "cairn.graph.temporal.structuralOnly";

export function loadStructuralOnly(): boolean {
  try {
    return localStorage.getItem(STRUCTURAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveStructuralOnly(on: boolean): void {
  try {
    localStorage.setItem(STRUCTURAL_KEY, on ? "1" : "0");
  } catch {
    // ignore (private mode / quota)
  }
}
```

- [ ] **Step 4: Run to verify pass.**

Run: `cd web && pnpm test -- src/components/graph/temporalControls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/graph/temporalControls.ts web/src/components/graph/temporalControls.test.ts
git commit -m "feat(graph): persist structural-only scrubber toggle"
```

---

### Task 3: Store loader + mock for the structural timeline

Add a parallel `temporal.structuralTimeline` field and a `loadStructuralTimeline()` action querying `structural_revisions`, plus a mock handler + fixture so it's testable offline. This introduces a required field on the temporal state, so the two test files that set `temporal` by literal need `structuralTimeline: null` added (mechanical).

**Files:**
- Modify: `web/src/store/store.ts` (temporal type ~L165, `EMPTY_TEMPORAL` ~L137, `seq` ~L276, store interface ~L241, actions ~L1147)
- Modify: `web/src/client/mock.ts` (constructor ~L191, query switch ~L496)
- Modify (add `structuralTimeline: null` to existing `temporal:` literals): `web/src/components/graph/useTemporalGraph.test.tsx`, `web/src/components/GraphView.test.tsx`
- Test: `web/src/store/store.test.ts`

**Interfaces:**
- Consumes: the `structural_revisions` query (Task 1).
- Produces: `temporal.structuralTimeline: Revision[] | null` (init `null`); store action `loadStructuralTimeline(): Promise<void>` writing it. `MockClient` constructor gains a 5th arg `structuralRevisions: Revision[] = []`.

- [ ] **Step 1: Write the failing store test.**

```ts
// store.test.ts — extend the setup() opts type with `structuralRevisions?: Revision[];`
// and pass it as the MockClient's 5th constructor arg.
it("loadStructuralTimeline loads only the structural revisions", async () => {
  const structural: Revision[] = [
    { id: "s1", message: "add link", timestamp_secs: 20n, author: "x" },
  ];
  const { store } = setup({ structuralRevisions: structural });
  await store.getState().loadStructuralTimeline();
  expect(store.getState().temporal.structuralTimeline).toEqual(structural);
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/store/store.test.ts -t "loadStructuralTimeline"`
Expected: FAIL — `loadStructuralTimeline` not a function / field missing.

- [ ] **Step 3: Add the mock handler + fixture.**

In `mock.ts`, add a constructor param and field mirroring `vaultHistory`:
```ts
// field, next to `private vaultHistory: Revision[];`
private structuralRevisions: Revision[];
// constructor: add 5th param `structuralRevisions: Revision[] = [],`
// and `this.structuralRevisions = structuralRevisions;`
```
Add the query case next to `vault_history`:
```ts
      case "structural_revisions": {
        const revs =
          q.limit === null
            ? this.structuralRevisions
            : this.structuralRevisions.slice(0, q.limit);
        return { type: "history", revisions: revs };
      }
```

- [ ] **Step 4: Add the store field, seq token, interface entry, and action.**

- `EMPTY_TEMPORAL` (~L137): add `structuralTimeline: null,`.
- temporal type (~L165): add `structuralTimeline: Revision[] | null;`.
- `seq` object (~L276): add `structuralTimeline: 0,`.
- store interface (~L241, near `loadVaultTimeline(): Promise<void>;`): add `loadStructuralTimeline(): Promise<void>;`.
- Action, directly after `loadVaultTimeline`:
```ts
      async loadStructuralTimeline() {
        const token = ++seq.structuralTimeline;
        try {
          const res = await client.runQuery({
            type: "structural_revisions",
            limit: null,
          });
          if (token !== seq.structuralTimeline) return;
          if (res.type === "history")
            set((s) => ({
              temporal: { ...s.temporal, structuralTimeline: res.revisions },
            }));
          else unexpected("Load structural timeline", res);
        } catch (err) {
          if (token === seq.structuralTimeline)
            pushError("Load structural timeline", err);
        }
      },
```

- [ ] **Step 5: Fix the two literal `temporal:` setState calls.**

In `useTemporalGraph.test.tsx` and `GraphView.test.tsx`, every `temporal: { timeline: …, snapshot: null, diff: null }` gains `structuralTimeline: null,`.

- [ ] **Step 6: Run to verify pass + no regression.**

Run: `cd web && pnpm typecheck && pnpm test -- src/store/store.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add web/src/store/store.ts web/src/client/mock.ts web/src/store/store.test.ts web/src/components/graph/useTemporalGraph.test.tsx web/src/components/GraphView.test.tsx
git commit -m "feat(store): loadStructuralTimeline via structural_revisions query"
```

---

### Task 4: Render the "Structural" toggle in the scrubber

A presentational toggle button. The scrubber does not fetch or filter — its parent hands it whichever `timeline` is active.

**Files:**
- Modify: `web/src/components/graph/TemporalScrubber.tsx`
- Test: `web/src/components/graph/TemporalScrubber.test.tsx`

**Interfaces:**
- Produces: two new `TemporalScrubber` props — `structuralOnly: boolean`, `onToggleStructural: (next: boolean) => void`.

- [ ] **Step 1: Write the failing tests.**

```tsx
// TemporalScrubber.test.tsx — add to renderScrubber's default props:
//   structuralOnly: false, onToggleStructural: vi.fn(),
describe("structural-only toggle", () => {
  it("reflects structuralOnly via aria-pressed", () => {
    renderScrubber({ structuralOnly: true });
    expect(
      screen.getByRole("button", { name: /structural/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("clicking requests the opposite state", async () => {
    const { onToggleStructural } = renderScrubber({ structuralOnly: false });
    await userEvent.click(screen.getByRole("button", { name: /structural/i }));
    expect(onToggleStructural).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/components/graph/TemporalScrubber.test.tsx -t "structural-only toggle"`
Expected: FAIL — no /structural/ button.

- [ ] **Step 3: Add props + button.**

In the props type (after `delta`):
```tsx
  structuralOnly: boolean;
  onToggleStructural: (next: boolean) => void;
```
Destructure them from `props`, then add the button after the `Live` button (reuse `segBtn`):
```tsx
        <button
          type="button"
          aria-pressed={structuralOnly}
          className={segBtn(structuralOnly)}
          onClick={() => onToggleStructural(!structuralOnly)}
          title="Show only commits that changed the graph"
        >
          Structural
        </button>
```

- [ ] **Step 4: Run to verify pass.**

Run: `cd web && pnpm test -- src/components/graph/TemporalScrubber.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/graph/TemporalScrubber.tsx web/src/components/graph/TemporalScrubber.test.tsx
git commit -m "feat(graph): add Structural toggle button to scrubber"
```

---

### Task 5: Wire the toggle into `useTemporalGraph`

The hook gains the toggle state, lazily loads the structural list on first activation, selects it as `displayTimeline`, and resets the selection to Live on every flip (the two lists differ in length/order, so a stored index would repoint).

**Files:**
- Modify: `web/src/components/graph/useTemporalGraph.ts`
- Test: `web/src/components/graph/useTemporalGraph.test.tsx`

**Interfaces:**
- Consumes: `loadStructuralOnly`/`saveStructuralOnly` (Task 2); `loadStructuralTimeline` + `temporal.structuralTimeline` (Task 3).
- Produces: the hook return gains `structuralOnly: boolean`, `setStructuralOnly: (next: boolean) => void`; its `timeline` becomes the active `displayTimeline` (`Revision[] | null`).

- [ ] **Step 1: Write the failing tests.**

```tsx
// useTemporalGraph.test.tsx — add loadStructuralTimeline to the beforeEach spies:
//   vi.spyOn(cairnStore.getState(), "loadStructuralTimeline").mockResolvedValue();
it("loads and shows the structural list when the toggle turns on", () => {
  const STRUCT: Revision[] = [
    { id: "s1", message: "link", timestamp_secs: 25n, author: "x" },
  ];
  vi.spyOn(cairnStore.getState(), "loadStructuralTimeline").mockImplementation(
    async () => {
      cairnStore.setState({
        temporal: { ...cairnStore.getState().temporal, structuralTimeline: STRUCT },
      });
    },
  );
  const { result } = renderHook(() => useTemporalGraph());
  act(() => result.current.setStructuralOnly(true));
  expect(cairnStore.getState().loadStructuralTimeline).toHaveBeenCalled();
  expect(result.current.timeline?.map((r) => r.id)).toEqual(["s1"]);
});

it("resets the selection to Live when the toggle flips", () => {
  const { result } = renderHook(() => useTemporalGraph());
  act(() => result.current.setSelection({ kind: "snapshot", at: 0 }));
  act(() => result.current.setStructuralOnly(true));
  expect(result.current.mode).toBe("live");
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/components/graph/useTemporalGraph.test.tsx`
Expected: FAIL — `setStructuralOnly` undefined.

- [ ] **Step 3: Implement the wiring.**

Extend the import:
```ts
import {
  selectionToRequest,
  loadTemporalOpen,
  saveTemporalOpen,
  loadStructuralOnly,
  saveStructuralOnly,
  type TemporalSelection,
} from "./temporalControls";
```
After the `open` state block, add:
```ts
  const [structuralOnly, setStructuralOnlyState] = useState(loadStructuralOnly);

  // The structural list is fetched lazily the first time the toggle turns on,
  // then reused (parallel to the always-loaded full timeline).
  useEffect(() => {
    if (structuralOnly && temporal.structuralTimeline === null) {
      void actions.loadStructuralTimeline();
    }
  }, [structuralOnly, temporal.structuralTimeline, actions]);

  // Full timeline while the structural list is still loading, so the scrubber
  // never disappears; selection is reset to Live on toggle, so no misindex.
  const displayTimeline = structuralOnly
    ? (temporal.structuralTimeline ?? temporal.timeline)
    : temporal.timeline;

  // Flipping the filter swaps to a different-length/-ordered list, so a stored
  // snapshot/compare index would point at the wrong revision. Reset to Live.
  const setStructuralOnly = (next: boolean) => {
    setStructuralOnlyState(next);
    saveStructuralOnly(next);
    setSelection({ kind: "live" });
  };
```
Change the request memo to use `displayTimeline`:
```ts
  const request = useMemo(
    () => selectionToRequest(selection, displayTimeline),
    [selection, displayTimeline],
  );
```
In the return: replace `timeline: temporal.timeline` with `timeline: displayTimeline`, and add `structuralOnly,` and `setStructuralOnly,`.

- [ ] **Step 4: Run to verify pass (incl. existing debounce/live tests).**

Run: `cd web && pnpm test -- src/components/graph/useTemporalGraph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/graph/useTemporalGraph.ts web/src/components/graph/useTemporalGraph.test.tsx
git commit -m "feat(graph): swap scrubber to structural_revisions when toggled"
```

---

### Task 6: Pass the toggle through `GraphView`

Wire the hook's new fields into `<TemporalScrubber>` so the feature is live end-to-end.

**Files:**
- Modify: `web/src/components/GraphView.tsx` (the `<TemporalScrubber …>` block, ~L698)
- Test: `web/src/components/GraphView.test.tsx`

**Interfaces:**
- Consumes: `temporal.structuralOnly`, `temporal.setStructuralOnly` (Task 5).

- [ ] **Step 1: Write the failing test.**

```tsx
// GraphView.test.tsx
it("shows the Structural toggle when the scrubber is open", async () => {
  vi.spyOn(cairnStore.getState(), "loadVaultTimeline").mockResolvedValue();
  vi.spyOn(cairnStore.getState(), "loadStructuralTimeline").mockResolvedValue();
  vi.spyOn(cairnStore.getState(), "clearTemporal").mockImplementation(() => {});
  cairnStore.setState({
    temporal: { timeline: TL, structuralTimeline: null, snapshot: null, diff: null },
  });
  setup({ nodes: [gnode("a.md")], activePath: null });
  await userEvent.click(screen.getByRole("button", { name: /graph history/i }));
  expect(screen.getByRole("button", { name: /structural/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/components/GraphView.test.tsx -t "Structural toggle"`
Expected: FAIL — no /structural/ button (props not wired).

- [ ] **Step 3: Wire the props.**

```tsx
        <TemporalScrubber
          timeline={temporal.timeline}
          selection={temporal.selection}
          onSelect={temporal.setSelection}
          counts={scrubberCounts}
          delta={scrubberDelta}
          structuralOnly={temporal.structuralOnly}
          onToggleStructural={temporal.setStructuralOnly}
        />
```

- [ ] **Step 4: Run to verify pass.**

Run: `cd web && pnpm test -- src/components/GraphView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gate.**

Run: `cd web && just web-ci` (or `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`)
Expected: all green, including `format:check`.

- [ ] **Step 6: Commit.**

```bash
git add web/src/components/GraphView.tsx web/src/components/GraphView.test.tsx
git commit -m "feat(graph): wire Structural toggle through GraphView"
```

---

## Notes for the executor

- **No client-side classification, no `Revision.structural`.** The engine returns a pre-filtered list from `structural_revisions`; the toggle just swaps which query feeds the scrubber. If you find yourself writing `.filter(r => r.structural)`, stop — that's the old (rejected) design.
- **Tags are not structural** (engine defines structural as node/edge add/remove only). Don't try to make tag changes count here.
- **Reset-to-Live on toggle is intentional** — it avoids a stored index pointing at the wrong revision after the list swaps. Don't "preserve position" across a toggle.
- The scrubber stays dumb: `timelineBuckets` and the slider domain get whichever array the parent passes. No filtering logic inside `TemporalScrubber`.
- Empty structural set → the scrubber gets `[]` and `selectionToRequest` degrades to Live. A "no structural revisions" hint is optional and out of scope.
