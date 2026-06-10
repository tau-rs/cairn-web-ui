import { describe, it, expect, beforeEach } from "vitest";
import { saveTabs, loadTabs } from "./tabsPersistence";
import type { TabsState } from "./tabsModel";

beforeEach(() => localStorage.clear());

const state: TabsState = {
  tabs: [
    { path: "a.md", preview: false },
    { path: "b.md", preview: false },
    { path: "scratch.md", preview: true }, // preview — must NOT persist
  ],
  activePath: "b.md",
};

describe("tabsPersistence", () => {
  it("round-trips pinned paths + active, excluding the preview tab", () => {
    saveTabs(state);
    expect(loadTabs(["a.md", "b.md", "scratch.md"])).toEqual({
      pinned: ["a.md", "b.md"],
      activePath: "b.md",
    });
  });
  it("drops persisted paths that no longer exist", () => {
    saveTabs(state);
    expect(loadTabs(["a.md"])).toEqual({
      pinned: ["a.md"],
      activePath: "a.md",
    });
  });
  it("returns empty when nothing is stored", () => {
    expect(loadTabs(["a.md"])).toEqual({ pinned: [], activePath: null });
  });
  it("returns empty on malformed storage", () => {
    localStorage.setItem("cairn.tabs", "{not json");
    expect(loadTabs(["a.md"])).toEqual({ pinned: [], activePath: null });
  });
});
