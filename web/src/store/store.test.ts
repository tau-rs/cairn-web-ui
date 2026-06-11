import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCairnStore, DEFAULT_SETTINGS, ERROR_TOAST_MS } from "./store";
import { MockClient } from "../client/mock";
import {
  loadOverrides,
  saveOverrides,
} from "../components/shortcuts/keybindingPersistence";
import type { QueryResponse } from "../contract";
import { saveTabs } from "../components/tabs/tabsPersistence";
import type { Event } from "../contract";
import * as timer from "../util/timer";

// Stub `subscribe` so it immediately reports an attach failure and delivers no
// events — simulating a channel that never came up (a dead push stream).
const failingSubscribe = (
  _cb: (e: Event) => void,
  onError?: (err: unknown) => void,
) => {
  onError?.(new Error("attach failed"));
  return () => {};
};

beforeEach(() => vi.useFakeTimers());
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

function setup() {
  const client = new MockClient({
    "a.md": "links to [[b]]",
    "b.md": "target note",
  });
  const store = createCairnStore(client);
  return { client, store };
}

describe("cairn store", () => {
  it("init loads the note list", async () => {
    const { store } = setup();
    await store.getState().init();
    expect(store.getState().notePaths).toEqual(["a.md", "b.md"]);
  });

  it("openNote loads contents and backlinks", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().openNote("b.md");
    expect(store.getState().activePath).toBe("b.md");
    expect(store.getState().activeContents).toBe("target note");
    expect(store.getState().backlinks).toEqual(["a.md"]);
  });

  it("editBuffer schedules a debounced autosave that writes the note", async () => {
    const { client, store } = setup();
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().editBuffer("edited body [[b]]");
    expect(store.getState().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(DEFAULT_SETTINGS.autosaveMs);
    const res = await client.runQuery({ type: "get_note", path: "a.md" });
    expect(res).toEqual({ type: "note", contents: "edited body [[b]]" });
    expect(store.getState().dirty).toBe(false);
  });

  it("runSearch populates results; closeSearch clears them", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().runSearch("target");
    expect(store.getState().searchResults).toEqual(["b.md"]);
    store.getState().closeSearch();
    expect(store.getState().searchResults).toBeNull();
  });

  it("commitManual commits and records the id", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().commitManual("snapshot");
    expect(store.getState().lastCommit).toBe("c0001");
  });

  it("reacts to a note_changed event by refreshing the note list", async () => {
    // Real timers here: vi.waitFor polls on real timers and the mock emits via
    // queueMicrotask, so mixing fake timers would hang.
    vi.useRealTimers();
    const { client, store } = setup();
    await store.getState().init();
    await client.sendCommand({
      type: "write_note",
      path: "c.md",
      contents: "hi",
    });
    await vi.waitFor(() =>
      expect(store.getState().notePaths).toContain("c.md"),
    );
  });

  it("surfaces errors from a failing command", async () => {
    const { client, store } = setup();
    vi.spyOn(client, "sendCommand").mockRejectedValueOnce(new Error("boom"));
    await store.getState().init();
    await store.getState().commitManual("x");
    expect(store.getState().errors[0].message).toContain("boom");
  });

  it("surfaces a degraded state when the event channel fails to attach", async () => {
    const { client, store } = setup();
    vi.spyOn(client, "subscribe").mockImplementation(failingSubscribe);
    await store.getState().init();
    expect(store.getState().liveUpdates).toBe("down");
  });

  it("refreshAll re-pulls note paths and clears the degraded state", async () => {
    vi.useRealTimers();
    const { client, store } = setup();
    // Stub the channel so pushed events never reach the store (a dead stream):
    // the note list goes stale until a manual refresh.
    vi.spyOn(client, "subscribe").mockImplementation(failingSubscribe);
    await store.getState().init();
    await client.sendCommand({
      type: "write_note",
      path: "c.md",
      contents: "hi",
    });
    expect(store.getState().notePaths).not.toContain("c.md"); // stale: no live event
    await store.getState().refreshAll();
    expect(store.getState().notePaths).toContain("c.md");
    expect(store.getState().liveUpdates).toBe("ok");
  });

  it("refreshAll reconciles the active tag filter (matching the live path)", async () => {
    vi.useRealTimers();
    const client = new MockClient({
      "a.md": "---\ntags: [keep]\n---\nfirst",
    });
    const store = createCairnStore(client);
    vi.spyOn(client, "subscribe").mockImplementation(failingSubscribe);
    await store.getState().init();
    await store.getState().filterByTag("keep");
    expect(store.getState().searchResults).toEqual(["a.md"]);
    // A second tagged note arrives, but the dead stream delivers no event.
    await client.sendCommand({
      type: "write_note",
      path: "b.md",
      contents: "---\ntags: [keep]\n---\nsecond",
    });
    expect(store.getState().searchResults).toEqual(["a.md"]); // stale filter view
    await store.getState().refreshAll();
    expect(store.getState().searchResults).toEqual(["a.md", "b.md"]);
  });

  it("surfaces an error if loading the note list fails", async () => {
    const { client, store } = setup();
    vi.spyOn(client, "runQuery").mockRejectedValueOnce({
      type: "internal",
      message: "boom",
    });
    await store.getState().init();
    expect(store.getState().errors[0].message).toContain("boom");
  });

  it("queues multiple errors instead of clobbering", async () => {
    const { client, store } = setup();
    vi.spyOn(client, "sendCommand").mockRejectedValue(new Error("boom"));
    await store.getState().init();
    await store.getState().commitManual("one");
    await store.getState().commitManual("two");
    expect(store.getState().errors).toHaveLength(2);
  });

  it("auto-dismisses a queued error after the timeout", async () => {
    const { client, store } = setup();
    vi.spyOn(client, "sendCommand").mockRejectedValue(new Error("boom"));
    await store.getState().init();
    await store.getState().commitManual("x");
    expect(store.getState().errors).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(ERROR_TOAST_MS);
    expect(store.getState().errors).toHaveLength(0);
  });

  it("logs caught errors to console.error with operation context", async () => {
    const { client, store } = setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(client, "runQuery").mockRejectedValueOnce({
      type: "internal",
      message: "boom",
    });
    await store.getState().init();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("List notes"),
      expect.objectContaining({
        operation: "List notes",
        error: expect.objectContaining({ type: "internal" }),
      }),
    );
    expect(store.getState().errors[0].message).toContain("List notes");
    spy.mockRestore();
  });

  it("keeps the buffer dirty if edited while a slow save is in flight", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "v0" });
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const orig = client.sendCommand.bind(client);
    vi.spyOn(client, "sendCommand").mockImplementation(async (c) => {
      await gate;
      return orig(c);
    });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().editBuffer("v1");
    const saving = store.getState().saveActive();
    store.getState().editBuffer("v2"); // user types while the save is gated
    release();
    await saving;
    expect(store.getState().dirty).toBe(true); // v2 is not yet persisted
  });

  it("interval auto-commit fires when enabled (idle disabled to isolate it)", async () => {
    const { client, store } = setup();
    const spy = vi.spyOn(client, "sendCommand");
    await store.getState().init();
    store.getState().setSettings({ idleAutoCommit: false }); // isolate the interval trigger
    await store.getState().openNote("a.md");
    store.getState().editBuffer("changed body [[b]]");
    await vi.advanceTimersByTimeAsync(DEFAULT_SETTINGS.autosaveMs); // autosave -> uncommitted
    await vi.advanceTimersByTimeAsync(
      DEFAULT_SETTINGS.intervalAutoCommitMin * 60_000,
    ); // interval fires
    expect(spy.mock.calls.some(([c]) => c.type === "commit")).toBe(true);
  });

  it("init is idempotent — a single event triggers one note-list refresh", async () => {
    vi.useRealTimers();
    const client = new MockClient({});
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().init(); // second call must be a no-op (no double subscription)
    const spy = vi.spyOn(client, "runQuery");
    await client.sendCommand({
      type: "write_note",
      path: "a.md",
      contents: "x",
    });
    await vi.waitFor(() =>
      expect(store.getState().notePaths).toContain("a.md"),
    );
    const listCalls = spy.mock.calls.filter(
      ([q]) => q.type === "list_notes",
    ).length;
    expect(listCalls).toBe(1);
  });

  it("loadGraph populates the graph from get_graph", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().loadGraph();
    const g = store.getState().graph;
    expect(g).not.toBeNull();
    expect([...g!.nodes].sort()).toEqual(["a.md", "b.md"]);
    expect(g!.edges).toEqual([{ from: "a.md", to: "b.md" }]);
  });

  it("refreshes the graph on a note event when it is loaded", async () => {
    vi.useRealTimers();
    const { client, store } = setup();
    await store.getState().init();
    await store.getState().loadGraph();
    await client.sendCommand({
      type: "write_note",
      path: "c.md",
      contents: "x",
    });
    await vi.waitFor(() =>
      expect(store.getState().graph!.nodes).toContain("c.md"),
    );
  });

  it("defaults the editor to live preview", () => {
    expect(DEFAULT_SETTINGS.editorMode).toBe("livepreview");
  });

  it("defaults loadRemoteImages to off (no auto-fetch of remote images)", () => {
    expect(DEFAULT_SETTINGS.loadRemoteImages).toBe(false);
  });

  it("defaults to an always-open cairn (mock) and sets cairnPath on init", async () => {
    const { store } = setup();
    await store.getState().init();
    expect(store.getState().cairnPath).toBe("(fixture)");
    expect(store.getState().notePaths.length).toBeGreaterThan(0);
  });

  it("openCairn sets cairnPath and loads notes via the host", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "x.md": "hi" });
    const host = {
      currentCairn: () => Promise.resolve<string | null>(null),
      openCairn: () => Promise.resolve<string | null>("/tmp/mycairn"),
      assetUrl: (p: string) => p,
    };
    const store = createCairnStore(client, host);
    await store.getState().init();
    expect(store.getState().cairnPath).toBeNull();
    await store.getState().openCairn();
    expect(store.getState().cairnPath).toBe("/tmp/mycairn");
    expect(store.getState().notePaths).toContain("x.md");
  });

  it("openCairn reloads tags + plugins, restores tabs, and resets the graph", async () => {
    vi.useRealTimers();
    localStorage.clear();
    const client = new MockClient({
      "a.md": "---\ntags: [rust]\n---\nlinks [[b]]",
      "b.md": "B",
    });
    const host = {
      currentCairn: () => Promise.resolve<string | null>(null),
      openCairn: () => Promise.resolve<string | null>("/tmp/second"),
      assetUrl: (p: string) => p,
    };
    // A pinned tab persisted from a prior session of this cairn.
    saveTabs({ tabs: [{ path: "b.md", preview: false }], activePath: "b.md" });
    const store = createCairnStore(client, host);
    await store.getState().init(); // currentCairn null -> nothing loaded yet
    await store.getState().loadGraph(); // graph now non-null (cairn-specific)

    await store.getState().openCairn();

    // Tags + plugins must reload, not stay empty until an unrelated event.
    expect(store.getState().tags).toEqual([{ tag: "rust", count: 1 }]);
    expect(store.getState().plugins.map((p) => p.id)).toEqual(["demo"]);
    // Persisted pinned tabs restore for the freshly opened cairn.
    expect(store.getState().tabs.map((t) => t.path)).toEqual(["b.md"]);
    expect(store.getState().activePath).toBe("b.md");
    // Derived graph is reset consistently (will reload when its panel asks).
    expect(store.getState().graph).toBeNull();
  });

  it("keeps each open note's buffer when switching tabs", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().editBuffer("edited A [[b]]"); // pins a.md, marks dirty
    await store.getState().openNote("b.md");
    expect(store.getState().activeContents).toBe("target note");
    await store.getState().openNote("a.md"); // back to A
    expect(store.getState().activeContents).toBe("edited A [[b]]");
    expect(store.getState().dirty).toBe(true);
  });

  it("editing pins the preview tab", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().openNote("a.md");
    expect(store.getState().tabs).toEqual([{ path: "a.md", preview: true }]);
    store.getState().editBuffer("x [[b]]");
    expect(store.getState().tabs).toEqual([{ path: "a.md", preview: false }]);
  });

  it("browsing notes (preview) does not write to disk", async () => {
    const { client, store } = setup();
    const spy = vi.spyOn(client, "sendCommand");
    await store.getState().init();
    await store.getState().openNote("a.md");
    await store.getState().openNote("b.md"); // replaces the preview tab
    await vi.advanceTimersByTimeAsync(DEFAULT_SETTINGS.autosaveMs);
    expect(spy.mock.calls.some(([c]) => c.type === "write_note")).toBe(false);
    expect(store.getState().tabs).toEqual([{ path: "b.md", preview: true }]);
  });

  it("closeTab focuses a neighbour; closing the last clears the editor", async () => {
    const { store } = setup();
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().pinTab("a.md");
    await store.getState().openNote("b.md");
    store.getState().pinTab("b.md");
    store.getState().selectTab("a.md");
    store.getState().closeTab("a.md");
    expect(store.getState().activePath).toBe("b.md"); // neighbour focused
    store.getState().closeTab("b.md");
    expect(store.getState().activePath).toBeNull();
    expect(store.getState().activeContents).toBe("");
    expect(store.getState().tabs).toEqual([]);
  });

  it("deleteNote closes the note's tab", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "A", "b.md": "B" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().pinTab("a.md");
    await store.getState().openNote("b.md");
    store.getState().pinTab("b.md");
    await store.getState().deleteNote("b.md");
    expect(store.getState().tabs.map((t) => t.path)).toEqual(["a.md"]);
    expect(store.getState().activePath).toBe("a.md");
  });

  it("restores persisted pinned tabs on init, skipping missing notes", async () => {
    vi.useRealTimers();
    localStorage.clear();
    // First store instance: open + pin two notes, which persists them.
    const c1 = new MockClient({ "a.md": "A", "b.md": "B" });
    const s1 = createCairnStore(c1);
    await s1.getState().init();
    await s1.getState().openNote("a.md");
    s1.getState().pinTab("a.md");
    await s1.getState().openNote("b.md");
    s1.getState().pinTab("b.md");
    s1.getState().selectTab("b.md");
    // Second instance with a fresh client missing b.md → only a.md restored.
    const c2 = new MockClient({ "a.md": "A" });
    const s2 = createCairnStore(c2);
    await s2.getState().init();
    expect(s2.getState().tabs.map((t) => t.path)).toEqual(["a.md"]);
    expect(s2.getState().activePath).toBe("a.md");
  });

  it("init flips ready true only after the restore completes", async () => {
    const { store } = setup();
    expect(store.getState().ready).toBe(false); // fresh store is not ready
    await store.getState().init();
    // ready is set last, so the persisted-tab restore has already run by now.
    expect(store.getState().ready).toBe(true);
  });

  it("flushes a dirty buffer to disk when its tab is closed", async () => {
    const { client, store } = setup();
    const spy = vi.spyOn(client, "sendCommand");
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().editBuffer("flushed [[b]]");
    store.getState().closeTab("a.md"); // close within the autosave window
    // Flush the in-flight write's microtasks (advance only the autosave window so
    // the recurring auto-commit interval armed by init() isn't tripped).
    await vi.advanceTimersByTimeAsync(DEFAULT_SETTINGS.autosaveMs);
    expect(
      spy.mock.calls.some(
        ([c]) => c.type === "write_note" && c.contents === "flushed [[b]]",
      ),
    ).toBe(true);
    const res = await client.runQuery({ type: "get_note", path: "a.md" });
    expect(res).toEqual({ type: "note", contents: "flushed [[b]]" });
  });

  it("does not resurrect a closed note's buffer; reopening shows saved contents", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "orig" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().editBuffer("changed");
    store.getState().closeTab("a.md");
    await vi.waitFor(async () => {
      const r = await client.runQuery({ type: "get_note", path: "a.md" });
      expect(r).toEqual({ type: "note", contents: "changed" });
    });
    expect(store.getState().openNotes["a.md"]).toBeUndefined(); // no phantom buffer
    await store.getState().openNote("a.md"); // reopen → fetched fresh
    expect(store.getState().activeContents).toBe("changed");
  });

  it("loadTags populates the tag list", async () => {
    vi.useRealTimers();
    const client = new MockClient({
      "a.md": "---\ntags: [rust, ideas]\n---\nx",
      "b.md": "---\ntags: [rust]\n---\ny",
    });
    const store = createCairnStore(client);
    await store.getState().init();
    expect(store.getState().tags).toEqual([
      { tag: "ideas", count: 1 },
      { tag: "rust", count: 2 },
    ]);
  });
  it("filterByTag fills the results overlay and sets activeTag", async () => {
    vi.useRealTimers();
    const client = new MockClient({
      "a.md": "---\ntags: [rust]\n---\nx",
      "b.md": "---\ntags: [ideas]\n---\ny",
    });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().filterByTag("rust");
    expect(store.getState().searchResults).toEqual(["a.md"]);
    expect(store.getState().activeTag).toBe("rust");
  });
  it("a search clears activeTag; closeSearch clears both", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "---\ntags: [rust]\n---\nx" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().filterByTag("rust");
    await store.getState().runSearch("a");
    expect(store.getState().activeTag).toBeNull();
    store.getState().closeSearch();
    expect(store.getState().searchResults).toBeNull();
    expect(store.getState().activeTag).toBeNull();
  });
  it("runSearch stores ranked paths + snippets keyed by path", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "the quick brown fox" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().runSearch("quick");
    expect(store.getState().searchResults).toEqual(["a.md"]);
    expect(store.getState().searchSnippets?.["a.md"].snippet).toContain(
      "quick",
    );
    expect(store.getState().searchSnippets?.["a.md"].highlights.length).toBe(1);
  });
  it("filterByTag leaves searchSnippets null; closeSearch clears it", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "---\ntags: [rust]\n---\nx" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().filterByTag("rust");
    expect(store.getState().searchSnippets).toBeNull();
    await store.getState().runSearch("x");
    store.getState().closeSearch();
    expect(store.getState().searchSnippets).toBeNull();
    expect(store.getState().searchResults).toBeNull();
  });
  it("refreshes the tag list on a note event", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "---\ntags: [rust]\n---\nx" });
    const store = createCairnStore(client);
    await store.getState().init();
    expect(store.getState().tags).toEqual([{ tag: "rust", count: 1 }]);
    await client.sendCommand({
      type: "write_note",
      path: "b.md",
      contents: "---\ntags: [rust, ideas]\n---\ny",
    });
    await vi.waitFor(() =>
      expect(store.getState().tags).toEqual([
        { tag: "ideas", count: 1 },
        { tag: "rust", count: 2 },
      ]),
    );
  });
  it("applyRenames moves an open note's tab + activePath to the new path", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "A", "b.md": "B" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().openNote("a.md");
    store.getState().pinTab("a.md");
    await store.getState().applyRenames([{ from: "a.md", to: "c.md" }]);
    expect(store.getState().activePath).toBe("c.md");
    expect(store.getState().tabs.map((t) => t.path)).toContain("c.md");
    expect(store.getState().tabs.map((t) => t.path)).not.toContain("a.md");
    expect(store.getState().openNotes["c.md"]).toBeDefined();
    expect(store.getState().openNotes["a.md"]).toBeUndefined();
  });
  it("applyRenames stops on the first error (no further commands)", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "A" });
    const spy = vi.spyOn(client, "sendCommand");
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().applyRenames([
      { from: "missing.md", to: "z.md" },
      { from: "a.md", to: "y.md" },
    ]);
    expect(store.getState().errors.length).toBeGreaterThan(0);
    const renameCalls = spy.mock.calls.filter(
      ([cmd]) => cmd.type === "rename_note",
    );
    expect(renameCalls.length).toBe(1);
    expect(store.getState().notePaths).toContain("a.md");
  });
  it("loadPlugins populates the plugin list on init", async () => {
    vi.useRealTimers();
    const store = createCairnStore(new MockClient({}));
    await store.getState().init();
    expect(store.getState().plugins.map((p) => p.id)).toEqual(["demo"]);
  });
  it("invokePlugin sets a notice and applies the side effect", async () => {
    vi.useRealTimers();
    const store = createCairnStore(new MockClient({}));
    await store.getState().init();
    await store.getState().invokePlugin("demo", "stamp");
    expect(store.getState().notice).toBe("stamp.md");
    await vi.waitFor(() =>
      expect(store.getState().notePaths).toContain("stamp.md"),
    );
    store.getState().dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it("a slow backlinks response for the previous note does not overwrite the current note", async () => {
    vi.useRealTimers();
    const client = new MockClient({
      "a.md": "x", // no backlinks
      "b.md": "x",
      "links-to-b.md": "see [[b]]", // b.md has one backlink
    });
    let releaseA = () => {};
    const gateA = new Promise<void>((r) => (releaseA = r));
    const orig = client.runQuery.bind(client);
    vi.spyOn(client, "runQuery").mockImplementation(async (q) => {
      if (q.type === "get_backlinks" && q.path === "a.md") await gateA;
      return orig(q);
    });
    const store = createCairnStore(client);
    await store.getState().init();

    const openA = store.getState().openNote("a.md"); // backlinks query gated
    const openB = store.getState().openNote("b.md"); // resolves immediately
    await openB;
    expect(store.getState().activePath).toBe("b.md");
    expect(store.getState().backlinks).toEqual(["links-to-b.md"]);

    releaseA();
    await openA;
    // a.md's stale (empty) backlinks must NOT have overwritten b.md's.
    expect(store.getState().backlinks).toEqual(["links-to-b.md"]);
  });

  it("a self-write (autosave) does not trigger the expensive index-wide refresh storm", async () => {
    vi.useRealTimers();
    const client = new MockClient({ "a.md": "orig [[b]]", "b.md": "B" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().loadGraph(); // graph non-null -> would rebuild
    await store.getState().openNote("a.md"); // activePath set
    const spy = vi.spyOn(client, "runQuery");

    store.getState().editBuffer("orig [[b]] more");
    await store.getState().saveActive(); // write_note -> echoed note_changed
    await Promise.resolve();
    await Promise.resolve();

    // Guard against a trivial pass: the write must actually have happened
    // (saveNote only sets uncommitted on a real successful write).
    expect(store.getState().uncommitted).toBe(true);
    // The storm — the index-wide list/tags refresh and the whole-graph rebuild —
    // must NOT fire for our own write.
    const storm = spy.mock.calls.filter(([q]) =>
      ["list_notes", "list_tags", "get_graph"].includes(q.type),
    );
    expect(storm).toEqual([]);
  });

  it("a self-write still refreshes the active note's targeted views (backlinks + open search)", async () => {
    vi.useRealTimers();
    // b.md does not yet match "needle" nor link to a.md.
    const client = new MockClient({ "a.md": "A", "b.md": "B" });
    const store = createCairnStore(client);
    await store.getState().init();
    await store.getState().openNote("a.md"); // a.md is active
    await store.getState().runSearch("needle"); // open search, no matches yet
    expect(store.getState().searchResults).toEqual([]);

    // Edit a.md so it now links to b.md AND contains the search term, then save.
    store.getState().editBuffer("A now links [[b]] and has a needle");
    await store.getState().saveActive(); // self-write -> echoed note_changed
    await Promise.resolve();
    await Promise.resolve();
    await vi.waitFor(() => {
      // The active search re-ran off the self-write and now finds a.md...
      expect(store.getState().searchResults).toContain("a.md");
    });
    // ...and b.md's backlinks would reflect a.md (targeted refresh still runs).
    await store.getState().openNote("b.md");
    expect(store.getState().backlinks).toContain("a.md");
  });

  it("starts with all loading flags false", () => {
    const { store } = setup();
    expect(store.getState().loading).toEqual({
      search: false,
      graph: false,
      backlinks: false,
      note: false,
    });
  });

  it("exposes loading.search while a search is in flight, clearing when it lands", async () => {
    vi.useRealTimers();
    const { client, store } = setup();
    await store.getState().init();
    let resolve!: (v: QueryResponse) => void;
    vi.spyOn(client, "runQuery").mockReturnValueOnce(
      new Promise<QueryResponse>((r) => (resolve = r)),
    );
    const p = store.getState().runSearch("x");
    expect(store.getState().loading.search).toBe(true);
    resolve({ type: "search_results", results: [] });
    await p;
    expect(store.getState().loading.search).toBe(false);
  });

  it("exposes loading.note while a note's contents load", async () => {
    vi.useRealTimers();
    const { client, store } = setup();
    await store.getState().init();
    let resolve!: (v: QueryResponse) => void;
    vi.spyOn(client, "runQuery").mockReturnValueOnce(
      new Promise<QueryResponse>((r) => (resolve = r)),
    );
    const p = store.getState().openNote("a.md");
    expect(store.getState().loading.note).toBe(true);
    resolve({ type: "note", contents: "hi" });
    await p;
    expect(store.getState().loading.note).toBe(false);
  });

  it("surfaces an error (not a silent no-op) when a query returns an unexpected variant", async () => {
    const { client, store } = setup();
    await store.getState().init();
    const before = store.getState().notePaths;
    // A valid response shape, but the wrong variant for list_notes. The old code
    // silently dropped it, leaving the list stale with no diagnostic.
    vi.spyOn(client, "runQuery").mockResolvedValueOnce({
      type: "tags",
      tags: [],
    });
    await store.getState().refreshNotePaths();
    expect(store.getState().notePaths).toEqual(before); // not silently mutated
    expect(
      store.getState().errors.some((e) => e.message.includes("List notes")),
    ).toBe(true);
  });

  it("logs an unexpected query variant through the existing error channel", async () => {
    const { client, store } = setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await store.getState().init();
    vi.spyOn(client, "runQuery").mockResolvedValueOnce({
      type: "notes",
      notes: [],
    });
    await store.getState().loadTags(); // expects "tags", gets "notes"
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Load tags"),
      expect.objectContaining({ operation: "Load tags" }),
    );
    spy.mockRestore();
  });

  it("reuses one persistent autosave debounce across rapid keystrokes, saving once", async () => {
    const { client, store } = setup();
    await store.getState().init();
    store.getState().setSettings({ idleAutoCommit: false }); // isolate the autosave debounce
    await store.getState().openNote("a.md");
    const construct = vi.spyOn(timer, "debounce");
    const send = vi.spyOn(client, "sendCommand");
    store.getState().editBuffer("a1 [[b]]");
    store.getState().editBuffer("a2 [[b]]");
    store.getState().editBuffer("a3 [[b]]");
    // One persistent per-path debounce, merely re-triggered — not one per keystroke.
    expect(construct).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_SETTINGS.autosaveMs);
    const writes = send.mock.calls.filter(([c]) => c.type === "write_note");
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toMatchObject({ path: "a.md", contents: "a3 [[b]]" });
  });

  it("exposes loading.graph while the graph loads", async () => {
    vi.useRealTimers();
    const { client, store } = setup();
    await store.getState().init();
    let resolve!: (v: QueryResponse) => void;
    vi.spyOn(client, "runQuery").mockReturnValueOnce(
      new Promise<QueryResponse>((r) => (resolve = r)),
    );
    const p = store.getState().loadGraph();
    expect(store.getState().loading.graph).toBe(true);
    resolve({ type: "graph", nodes: [], edges: [] });
    await p;
    expect(store.getState().loading.graph).toBe(false);
  });

  it("traces the refresh fan-out for an external note_changed (DG5/DX4)", async () => {
    // Real timers: the mock emits via queueMicrotask and vi.waitFor polls on
    // real timers (mirrors the note_changed test above).
    vi.useRealTimers();
    const events: { type: string; actions: string[] }[] = [];
    const trace = {
      event: (type: string, actions: string[]) =>
        events.push({ type, actions }),
      time: <T>(_label: string, fn: () => Promise<T>) => fn(),
    };
    const client = new MockClient({ "a.md": "links to [[b]]", "b.md": "x" });
    const store = createCairnStore(client, undefined, trace);
    await store.getState().init();
    // An external write (straight to the client, not via store.saveNote) is not
    // a self-write, so it triggers the full index-wide fan-out.
    await client.sendCommand({
      type: "write_note",
      path: "c.md",
      contents: "hi",
    });
    await vi.waitFor(() =>
      expect(events.some((e) => e.type === "note_changed")).toBe(true),
    );
    const fanout = events.find((e) => e.type === "note_changed")!;
    expect(fanout.actions).toContain("refreshNotePaths");
    expect(fanout.actions).toContain("loadTags");
  });

  it("skips the index-wide fan-out for a self-write echo (DG5/DX4)", async () => {
    vi.useRealTimers();
    const events: { type: string; actions: string[] }[] = [];
    const trace = {
      event: (type: string, actions: string[]) =>
        events.push({ type, actions }),
      time: <T>(_label: string, fn: () => Promise<T>) => fn(),
    };
    const client = new MockClient({ "a.md": "body" });
    const store = createCairnStore(client, undefined, trace);
    await store.getState().init();
    await store.getState().openNote("a.md");
    events.length = 0; // ignore the open's backlinks refresh
    store.getState().editBuffer("body edited");
    // The debounced autosave writes via the store, marking pendingSelfWrites, so
    // the echoed note_changed is a self-write: no refreshNotePaths/loadTags.
    await vi.waitFor(
      () => expect(events.some((e) => e.type === "note_changed")).toBe(true),
      { timeout: 3000 },
    );
    const echo = events.find((e) => e.type === "note_changed")!;
    expect(echo.actions).not.toContain("refreshNotePaths");
    expect(echo.actions).not.toContain("loadTags");
  });
});

describe("ui slice", () => {
  it("setUi patches ui flags without touching others", () => {
    const { store } = setup();
    store.getState().setUi({ commitOpen: true });
    expect(store.getState().ui.commitOpen).toBe(true);
    store.getState().setUi({ newNoteOpen: true, newNoteInitial: "folder/" });
    expect(store.getState().ui.newNoteOpen).toBe(true);
    expect(store.getState().ui.newNoteInitial).toBe("folder/");
    expect(store.getState().ui.commitOpen).toBe(true); // untouched
  });

  it("setKeybindingOverrides updates state and persists", () => {
    const { store } = setup();
    store.getState().setKeybindingOverrides({ "new-note": "Mod+Shift+N" });
    expect(store.getState().ui.keybindingOverrides).toEqual({
      "new-note": "Mod+Shift+N",
    });
    expect(loadOverrides()).toEqual({ "new-note": "Mod+Shift+N" });
  });

  it("init seeds keybindingOverrides from persistence", async () => {
    saveOverrides({ commit: null });
    const { store } = setup();
    await store.getState().init();
    expect(store.getState().ui.keybindingOverrides).toEqual({ commit: null });
  });
});
