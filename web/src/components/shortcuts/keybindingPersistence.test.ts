import { describe, it, expect, beforeEach } from "vitest";
import { loadOverrides, saveOverrides } from "./keybindingPersistence";

beforeEach(() => localStorage.clear());

describe("keybindingPersistence", () => {
  it("round-trips overrides including explicit null (unbound)", () => {
    saveOverrides({ "new-note": "Mod+J", "close-tab": null });
    expect(loadOverrides()).toEqual({ "new-note": "Mod+J", "close-tab": null });
  });
  it("returns {} when nothing stored", () => {
    expect(loadOverrides()).toEqual({});
  });
  it("returns {} on malformed storage", () => {
    localStorage.setItem("cairn.keybindings", "{not json");
    expect(loadOverrides()).toEqual({});
  });
  it("drops non-string / non-null values", () => {
    localStorage.setItem(
      "cairn.keybindings",
      JSON.stringify({ a: "Mod+A", b: 5, c: null }),
    );
    expect(loadOverrides()).toEqual({ a: "Mod+A", c: null });
  });
});
