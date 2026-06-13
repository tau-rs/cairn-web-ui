import { describe, it, expect, beforeEach } from "vitest";
import { loadStyles, saveStyles, type TreeStyleMap } from "./treeIcons";

beforeEach(() => localStorage.clear());

describe("treeIcons persistence", () => {
  it("returns {} when nothing stored", () => {
    expect(loadStyles()).toEqual({});
  });

  it("round-trips a saved map", () => {
    const map: TreeStyleMap = {
      "notes/a.md": { icon: { kind: "emoji", value: "📚" } },
      notes: { folderColor: "#46b3e6" },
    };
    saveStyles(map);
    expect(loadStyles()).toEqual(map);
  });

  it("returns {} on malformed JSON", () => {
    localStorage.setItem("cairn.treeIcons", "{not json");
    expect(loadStyles()).toEqual({});
  });

  it("returns {} when stored value is not an object", () => {
    localStorage.setItem("cairn.treeIcons", "[1,2,3]");
    expect(loadStyles()).toEqual({});
  });
});
