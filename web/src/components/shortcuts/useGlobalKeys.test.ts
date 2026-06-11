import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGlobalKeys } from "./useGlobalKeys";
import { eventToChord } from "./keybinding";

describe("useGlobalKeys", () => {
  it("dispatches a mapped chord to runCommand", () => {
    const run = vi.fn();
    // Derive the canonical chord from the same event shape we dispatch, so the
    // test is independent of the platform's Mod-key mapping.
    const chord = eventToChord(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    )!;
    renderHook(() => useGlobalKeys({ [chord]: "open-palette" }, run));
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    );
    expect(run).toHaveBeenCalledWith("open-palette");
  });

  it("ignores an unmapped chord", () => {
    const run = vi.fn();
    renderHook(() => useGlobalKeys({}, run));
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    );
    expect(run).not.toHaveBeenCalled();
  });
});
