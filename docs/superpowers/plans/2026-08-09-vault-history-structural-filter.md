# Vault-history structural-marker filter — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Structural only" toggle to the vault-history scrubber that filters its histogram + slider domain to graph-changing commits, driven by a new `Revision.structural` contract field.

**Architecture:** This is the **UI half** of an engine-first feature (spec: `docs/superpowers/specs/2026-08-09-vault-history-structural-filter-design.md`). The engine classifier + the `Revision.structural` contract field ship from the `tau-rs/cairn` repo first. Here we re-sync the vendored contract, then let `useTemporalGraph` derive a filtered `displayTimeline` and `TemporalScrubber` render the toggle. The scrubber stays presentational; the hook owns the filter state, persistence, and the reset-to-Live-on-toggle rule.

**Tech Stack:** React + TypeScript, Zustand store, Vitest + Testing Library, ts-rs-generated vendored contract, `just` task runner (pnpm under the hood).

## Global Constraints

- **PREREQUISITE — engine-first, blocking:** The engine PR in `tau-rs/cairn` that adds `Revision.structural` (per the spec's classifier) MUST be merged and its engine rev recorded before Task 1 runs. Until then this whole plan is blocked; do not hand-author the field.
- **Vendored contract is generated, never hand-edited.** `web/src/contract/*` is raw ts-rs output, listed in `web/.prettierignore`. Regenerate only via `scripts/sync-contract.sh`; the drift gate is `scripts/check-contract-drift.sh`.
- **`Revision.structural` is a required `boolean`** (ts-rs emits required fields). Every `Revision` object literal in the codebase must carry it or TypeScript won't compile.
- **Single-branch discipline:** run `scripts/claim-plan.sh vault-history-structural-filter` before executing; if FREE, create + push the feature branch immediately (empty commit fine) to plant the flag, then record it in `.context/OWNERS.md`.
- **Full gate before any "done" claim:** `just web-ci` = `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` (run from `web/`). `prettier --check` (`format:check`) is easy to miss — eslint won't catch it.
- Single test file: `cd web && pnpm test -- <path>`; single case: add `-t "<name>"`.

---

### Task 1: Sync the contract & restore a green build

Bring in `Revision.structural` from the merged engine rev and update every `Revision` literal so the project compiles and all existing tests pass — no behavior change yet. This is the mechanical "catch the contract up" task; the feature tasks build on it.

**Files:**
- Modify (generated): `web/src/contract/Revision.ts` — via `scripts/sync-contract.sh`, not by hand.
- Modify: `web/src/client/mock.ts` — the default `vaultHistory` seed + any inline `Revision` literals.
- Modify (test fixtures, add `structural` to each literal): `web/src/components/graph/TemporalScrubber.test.tsx`, `web/src/components/graph/useTemporalGraph.test.tsx`, `web/src/components/graph/temporalControls.test.ts`, `web/src/components/graph/timelineDensity.test.ts`, `web/src/components/GraphView.test.tsx`, `web/src/store/store.test.ts`, `web/src/store/historySlice.test.ts`, `web/src/client/mock.test.ts`, `web/src/components/history/HistoryPane.test.tsx`, `web/src/components/history/HistoryList.test.tsx`, and any other file surfaced by the grep below.

**Interfaces:**
- Produces: `Revision` now has `structural: boolean`. Later tasks read `r.structural`.

- [ ] **Step 1: Confirm the prerequisite.** Verify the engine rev adding `Revision.structural` is merged and known. If not, STOP — the plan is blocked.

- [ ] **Step 2: Regenerate the vendored contract.**

Run: `scripts/sync-contract.sh` (pointing at the recorded engine rev, per the script's usage), then:
```bash
git diff web/src/contract/Revision.ts
```
Expected: `Revision` gains `structural: boolean`. Do not edit the file by hand.

- [ ] **Step 3: Find every Revision literal that now fails to compile.**

Run:
```bash
cd web && pnpm typecheck 2>&1 | head -40
grep -rn 'timestamp_secs:' src | grep -v contract/
```
Expected: typecheck errors "Property 'structural' is missing" at each `Revision` literal; the grep lists them (~33 sites).

- [ ] **Step 4: Add `structural` to every Revision literal.** For plain fixtures use a neutral `structural: false` unless the fixture's intent is a structural commit. In the mock's default `vaultHistory` seed, seed a realistic **mix** (at least one `true` and one `false`) so offline/browser QA exercises the filter. For local `rev()` factories (e.g. `timelineDensity.test.ts`), add a defaulted param once:

```ts
// timelineDensity.test.ts — before
const rev = (id: string, t: bigint, msg = id): Revision => ({
  id, message: msg, timestamp_secs: t, author: "a",
});
// after
const rev = (id: string, t: bigint, msg = id, structural = false): Revision => ({
  id, message: msg, timestamp_secs: t, author: "a", structural,
});
```

- [ ] **Step 5: Verify the build is green with no behavior change.**

Run: `cd web && pnpm typecheck && pnpm test`
Expected: PASS. (Existing tests unchanged; the new field is present but unused.)

- [ ] **Step 6: Verify the contract drift gate passes.**

Run: `scripts/check-contract-drift.sh`
Expected: no drift (vendored contract matches the engine rev).

- [ ] **Step 7: Commit.**

```bash
git add web/src/contract web/src/client/mock.ts web/src/**/*.test.ts web/src/**/*.test.tsx
git commit -m "feat(contract): sync Revision.structural; seed fixtures"
```

---

### Task 2: Persist the structural-only toggle

Add load/save helpers for the toggle's on/off state, mirroring the existing `loadTemporalOpen`/`saveTemporalOpen` pattern. Pure functions, testable in isolation before any UI exists.

**Files:**
- Modify: `web/src/components/graph/temporalControls.ts`
- Test: `web/src/components/graph/temporalControls.test.ts`

**Interfaces:**
- Produces: `loadStructuralOnly(): boolean`, `saveStructuralOnly(on: boolean): void`. Storage key `"cairn.graph.temporal.structuralOnly"`, `"1"`/`"0"`, defaulting to `false`, swallowing storage errors — identical semantics to `loadTemporalOpen`/`saveTemporalOpen`.

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

- [ ] **Step 2: Run it to verify it fails.**

Run: `cd web && pnpm test -- src/components/graph/temporalControls.test.ts`
Expected: FAIL — `loadStructuralOnly` / `saveStructuralOnly` not exported.

- [ ] **Step 3: Implement the helpers.**

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

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd web && pnpm test -- src/components/graph/temporalControls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/graph/temporalControls.ts web/src/components/graph/temporalControls.test.ts
git commit -m "feat(graph): persist structural-only scrubber toggle"
```

---

### Task 3: Render the "Structural only" toggle in the scrubber

Add a presentational toggle button to `TemporalScrubber`. The scrubber does NOT filter anything — its parent already hands it the (possibly filtered) `timeline`. The button reflects state, fires a callback, and disables when no structural revisions exist.

**Files:**
- Modify: `web/src/components/graph/TemporalScrubber.tsx`
- Test: `web/src/components/graph/TemporalScrubber.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: three new `TemporalScrubber` props — `structuralOnly: boolean`, `onToggleStructural: (next: boolean) => void`, `structuralEnabled: boolean`. When `structuralEnabled` is false the button is `disabled` and rendered un-pressed.

- [ ] **Step 1: Write the failing tests.**

```tsx
// TemporalScrubber.test.tsx — extend renderScrubber's default props first:
//   structuralOnly: false, onToggleStructural: vi.fn(), structuralEnabled: true,
// then add:
describe("structural-only toggle", () => {
  it("renders a Structural toggle reflecting structuralOnly", () => {
    renderScrubber({ structuralOnly: true });
    const btn = screen.getByRole("button", { name: /structural/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking the toggle requests the opposite state", async () => {
    const { onToggleStructural } = renderScrubber({ structuralOnly: false });
    await userEvent.click(screen.getByRole("button", { name: /structural/i }));
    expect(onToggleStructural).toHaveBeenCalledWith(true);
  });

  it("disables the toggle when no structural revisions exist", () => {
    renderScrubber({ structuralEnabled: false });
    expect(screen.getByRole("button", { name: /structural/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/components/graph/TemporalScrubber.test.tsx -t "structural-only toggle"`
Expected: FAIL — no button named /structural/.

- [ ] **Step 3: Add the props and the button.**

In the props type (after `delta`):
```tsx
  structuralOnly: boolean;
  onToggleStructural: (next: boolean) => void;
  structuralEnabled: boolean;
```
Destructure them from `props`. Add the button in the controls row, right after the `Live` button (reuse the existing `segBtn` styling):
```tsx
        <button
          type="button"
          aria-pressed={structuralOnly}
          disabled={!structuralEnabled}
          className={
            segBtn(structuralOnly) +
            (structuralEnabled ? "" : " cursor-not-allowed opacity-40")
          }
          onClick={() => onToggleStructural(!structuralOnly)}
          title={
            structuralEnabled
              ? "Show only commits that changed the graph"
              : "No structural revisions in this vault"
          }
        >
          Structural
        </button>
```

The conditional `title` is the "no structural revisions" hint the spec calls for — a disabled button plus an explanatory tooltip, no extra layout.

- [ ] **Step 4: Run to verify pass.**

Run: `cd web && pnpm test -- src/components/graph/TemporalScrubber.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/graph/TemporalScrubber.tsx web/src/components/graph/TemporalScrubber.test.tsx
git commit -m "feat(graph): add Structural-only toggle button to scrubber"
```

---

### Task 4: Wire the filter into `useTemporalGraph`

The hook gains the toggle state, derives a filtered `displayTimeline`, feeds it to both the request builder and the scrubber, and resets the selection to Live whenever the toggle flips (avoiding stale index → wrong-revision bugs). It also computes `structuralEnabled` from the full timeline.

**Files:**
- Modify: `web/src/components/graph/useTemporalGraph.ts`
- Test: `web/src/components/graph/useTemporalGraph.test.tsx`

**Interfaces:**
- Consumes: `loadStructuralOnly`, `saveStructuralOnly` (Task 2); `r.structural` (Task 1).
- Produces: the hook's return object gains `structuralOnly: boolean`, `setStructuralOnly: (next: boolean) => void`, `structuralEnabled: boolean`; its returned `timeline` becomes the filtered `displayTimeline` (still `Revision[] | null`, null preserved). GraphView (Task 5) consumes these.

- [ ] **Step 1: Write the failing tests.**

```tsx
// useTemporalGraph.test.tsx — replace TL with a mixed fixture near the top:
const MIXED: Revision[] = [
  { id: "r3", message: "link", timestamp_secs: 30n, author: "x", structural: true },
  { id: "r2", message: "typo", timestamp_secs: 20n, author: "x", structural: false },
  { id: "r1", message: "init", timestamp_secs: 10n, author: "x", structural: true },
];
// (also add `structural: false` to the existing TL literals so the file compiles)

it("filters the timeline to structural revisions when structuralOnly is on", () => {
  cairnStore.setState({ temporal: { timeline: MIXED, snapshot: null, diff: null } });
  const { result } = renderHook(() => useTemporalGraph());
  act(() => result.current.setStructuralOnly(true));
  expect(result.current.timeline?.map((r) => r.id)).toEqual(["r3", "r1"]);
});

it("resets the selection to Live when the toggle flips", () => {
  cairnStore.setState({ temporal: { timeline: MIXED, snapshot: null, diff: null } });
  const { result } = renderHook(() => useTemporalGraph());
  act(() => result.current.setSelection({ kind: "snapshot", at: 0 }));
  act(() => result.current.setStructuralOnly(true));
  expect(result.current.mode).toBe("live");
});

it("marks structuralEnabled false when no revision is structural", () => {
  cairnStore.setState({
    temporal: {
      timeline: [{ id: "r1", message: "x", timestamp_secs: 10n, author: "x", structural: false }],
      snapshot: null, diff: null,
    },
  });
  const { result } = renderHook(() => useTemporalGraph());
  expect(result.current.structuralEnabled).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd web && pnpm test -- src/components/graph/useTemporalGraph.test.tsx`
Expected: FAIL — `setStructuralOnly` / `structuralEnabled` undefined.

- [ ] **Step 3: Implement the wiring.**

Add the import:
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
Add state + derivations (after the `open` state block):
```ts
  const [structuralOnly, setStructuralOnlyState] = useState(loadStructuralOnly);

  const full = temporal.timeline;
  const structuralEnabled = !!full && full.some((r) => r.structural);
  const displayTimeline =
    full && structuralOnly && structuralEnabled
      ? full.filter((r) => r.structural)
      : full;

  // Flipping the filter remaps every index in `timeline`, so a stored snapshot/
  // compare index would point at a different revision. Reset to Live — the
  // honest "I just changed what I'm looking at" state.
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
Change the return: replace `timeline: temporal.timeline` with `timeline: displayTimeline` and add the three fields:
```ts
  return {
    timeline: displayTimeline,
    selection,
    setSelection,
    open,
    setOpen,
    structuralOnly,
    setStructuralOnly,
    structuralEnabled,
    mode,
    source,
    diff,
  };
```

- [ ] **Step 4: Run to verify pass (and no regression).**

Run: `cd web && pnpm test -- src/components/graph/useTemporalGraph.test.tsx`
Expected: PASS, including the pre-existing debounce/live tests.

- [ ] **Step 5: Commit.**

```bash
git add web/src/components/graph/useTemporalGraph.ts web/src/components/graph/useTemporalGraph.test.tsx
git commit -m "feat(graph): filter scrubber timeline to structural revisions"
```

---

### Task 5: Pass the toggle through `GraphView`

Wire the hook's new fields into the `TemporalScrubber` element so the feature is live end-to-end.

**Files:**
- Modify: `web/src/components/GraphView.tsx` (the `<TemporalScrubber …>` block, ~line 697)
- Test: `web/src/components/GraphView.test.tsx`

**Interfaces:**
- Consumes: `temporal.structuralOnly`, `temporal.setStructuralOnly`, `temporal.structuralEnabled` (Task 4).

- [ ] **Step 1: Write the failing test.**

```tsx
// GraphView.test.tsx — MIXED fixture with structural flags:
it("shows an enabled Structural toggle when structural revisions exist", async () => {
  vi.spyOn(cairnStore.getState(), "loadVaultTimeline").mockResolvedValue();
  vi.spyOn(cairnStore.getState(), "clearTemporal").mockImplementation(() => {});
  cairnStore.setState({
    temporal: {
      timeline: [
        { id: "r2", message: "link", timestamp_secs: 20n, author: "x", structural: true },
        { id: "r1", message: "init", timestamp_secs: 10n, author: "x", structural: false },
      ],
      snapshot: null, diff: null,
    },
  });
  setup({ nodes: [gnode("a.md")], activePath: null });
  await userEvent.click(screen.getByRole("button", { name: /graph history/i }));
  expect(screen.getByRole("button", { name: /structural/i })).toBeEnabled();
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
          structuralEnabled={temporal.structuralEnabled}
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
git commit -m "feat(graph): wire Structural-only toggle through GraphView"
```

---

## Notes for the executor

- **Reset-to-Live on toggle is intentional** (spec decision 4). Do not "improve" it to snap-to-nearest without re-opening the design — it's what keeps stored indices from pointing at the wrong revision.
- The scrubber is deliberately dumb: all filtering lives in `useTemporalGraph`, so `timelineBuckets` and the slider domain get the already-filtered array for free. Don't add filtering logic inside `TemporalScrubber`.
- `structural` on `note_history` revisions is populated by the engine but has no UI consumer yet — that's out of scope here (a future note-history timeline piece).
