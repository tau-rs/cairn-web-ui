import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTemporalGraph } from "./useTemporalGraph";
import { cairnStore } from "../../app/cairnStore";
import type { Revision } from "../../contract";

const TL: Revision[] = [
  { id: "r2", message: "add b", timestamp_secs: 20n, author: "x" },
  { id: "r1", message: "init", timestamp_secs: 10n, author: "x" },
];

describe("useTemporalGraph", () => {
  beforeEach(() => {
    // Neutralize the real load actions so effects don't hit the fixture mock or
    // clobber the seeded timeline; Task 4 already tests the real actions.
    vi.spyOn(cairnStore.getState(), "loadTimeline").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "loadSnapshot").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "loadDiff").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "clearTemporal").mockImplementation(
      () => {},
    );
    cairnStore.setState({
      temporal: { timeline: TL, snapshot: null, diff: null },
    });
  });

  it("is disabled with no active note; loads the timeline when one opens", () => {
    const { result, rerender } = renderHook(({ p }) => useTemporalGraph(p), {
      initialProps: { p: null as string | null },
    });
    expect(result.current.disabled).toBe(true);

    rerender({ p: "a.md" });
    expect(result.current.disabled).toBe(false);
    expect(cairnStore.getState().loadTimeline).toHaveBeenCalledWith("a.md");
    expect(result.current.mode).toBe("live");
    expect(result.current.source).toBeNull();
  });

  it("dispatches loadSnapshot with the mapped revision on a tick selection", () => {
    const { result } = renderHook(() => useTemporalGraph("a.md"));
    act(() => result.current.setSelection({ kind: "snapshot", at: 0 })); // r2
    expect(cairnStore.getState().loadSnapshot).toHaveBeenCalledWith("r2");
    expect(result.current.mode).toBe("snapshot");
  });

  it("reflects a seeded snapshot as the source in snapshot mode", () => {
    cairnStore.setState({
      temporal: {
        timeline: TL,
        snapshot: {
          nodes: [{ path: "a.md", title: "a", mtime_secs: 0n }],
          edges: [],
        },
        diff: null,
      },
    });
    const { result } = renderHook(() => useTemporalGraph("a.md"));
    act(() => result.current.setSelection({ kind: "snapshot", at: 0 }));
    expect(result.current.source?.nodes.map((n) => n.path)).toEqual(["a.md"]);
  });
});
