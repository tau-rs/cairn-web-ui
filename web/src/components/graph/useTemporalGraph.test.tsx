import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
    vi.useFakeTimers();
    vi.spyOn(cairnStore.getState(), "loadVaultTimeline").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "loadSnapshot").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "loadDiff").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "clearTemporal").mockImplementation(
      () => {},
    );
    cairnStore.setState({
      temporal: { timeline: TL, snapshot: null, diff: null },
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

  it("dispatches loadDiff on a compare selection after the delay", () => {
    const { result } = renderHook(() => useTemporalGraph());
    act(() => result.current.setSelection({ kind: "compare", from: 1, to: 0 }));
    act(() => vi.advanceTimersByTime(150));
    expect(cairnStore.getState().loadDiff).toHaveBeenCalledWith("r1", "r2");
    expect(result.current.mode).toBe("compare");
  });
});
