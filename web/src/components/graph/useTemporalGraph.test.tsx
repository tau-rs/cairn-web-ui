import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTemporalGraph } from "./useTemporalGraph";
import { cairnStore } from "../../app/cairnStore";
import type { Revision } from "../../contract";

const TL: Revision[] = [
  { id: "r2", message: "add b", timestamp_secs: 20, author: "x" },
  { id: "r1", message: "init", timestamp_secs: 10, author: "x" },
];

describe("useTemporalGraph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(cairnStore.getState(), "loadVaultTimeline").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "loadSnapshot").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "loadDiff").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "clearTemporal").mockImplementation(
      () => {},
    );
    vi.spyOn(
      cairnStore.getState(),
      "loadStructuralTimeline",
    ).mockResolvedValue();
    cairnStore.setState({
      temporal: {
        timeline: TL,
        structuralTimeline: null,
        snapshot: null,
        diff: null,
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("loads the whole-vault timeline on mount and starts live", () => {
    const { result } = renderHook(() => useTemporalGraph());
    expect(cairnStore.getState().loadVaultTimeline).toHaveBeenCalled();
    expect(result.current.mode).toBe("live");
    expect(result.current.source).toBeNull();
  });

  it("debounces loadSnapshot until the delay elapses on a snapshot selection", () => {
    const { result } = renderHook(() => useTemporalGraph());
    act(() => result.current.setSelection({ kind: "snapshot", at: 0 })); // r2
    expect(cairnStore.getState().loadSnapshot).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(150));
    expect(cairnStore.getState().loadSnapshot).toHaveBeenCalledWith("r2");
    expect(result.current.mode).toBe("snapshot");
  });

  it("clears temporal immediately (no debounce) when returning to live", () => {
    const { result } = renderHook(() => useTemporalGraph());
    act(() => result.current.setSelection({ kind: "snapshot", at: 0 }));
    act(() => vi.advanceTimersByTime(150));
    act(() => result.current.setSelection({ kind: "live" }));
    expect(cairnStore.getState().clearTemporal).toHaveBeenCalled();
  });

  it("cancels a pending snapshot load when returning to live before the debounce fires", () => {
    const { result } = renderHook(() => useTemporalGraph());
    // Spies are shared across this file's tests (beforeEach re-spies but doesn't
    // clear); scope the assertion to this interaction only.
    const { loadSnapshot, loadDiff, clearTemporal } = cairnStore.getState();
    vi.mocked(loadSnapshot).mockClear();
    vi.mocked(loadDiff).mockClear();
    vi.mocked(clearTemporal).mockClear();

    act(() => result.current.setSelection({ kind: "snapshot", at: 0 }));
    act(() => vi.advanceTimersByTime(100)); // < 150ms: debounce still pending
    act(() => result.current.setSelection({ kind: "live" }));
    act(() => vi.advanceTimersByTime(100)); // cumulative > 150ms, but it was cancelled
    expect(loadSnapshot).not.toHaveBeenCalled();
    expect(loadDiff).not.toHaveBeenCalled();
    expect(clearTemporal).toHaveBeenCalled();
  });

  it("dispatches loadDiff on a compare selection after the delay", () => {
    const { result } = renderHook(() => useTemporalGraph());
    act(() => result.current.setSelection({ kind: "compare", from: 1, to: 0 }));
    act(() => vi.advanceTimersByTime(150));
    expect(cairnStore.getState().loadDiff).toHaveBeenCalledWith("r1", "r2");
    expect(result.current.mode).toBe("compare");
  });

  it("loads and shows the structural list when the toggle turns on", () => {
    const STRUCT: Revision[] = [
      { id: "s1", message: "link", timestamp_secs: 25, author: "x" },
    ];
    vi.spyOn(
      cairnStore.getState(),
      "loadStructuralTimeline",
    ).mockImplementation(async () => {
      cairnStore.setState({
        temporal: {
          ...cairnStore.getState().temporal,
          structuralTimeline: STRUCT,
        },
      });
    });
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

  it("resets the selection to Live when the toggle flips back off", () => {
    const { result } = renderHook(() => useTemporalGraph());
    act(() => result.current.setStructuralOnly(true));
    act(() => result.current.setSelection({ kind: "snapshot", at: 0 }));
    act(() => result.current.setStructuralOnly(false));
    expect(result.current.mode).toBe("live");
  });
});
