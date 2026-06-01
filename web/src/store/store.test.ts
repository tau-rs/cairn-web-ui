import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCairnStore, DEFAULT_SETTINGS } from "./store";
import { MockClient } from "../client/mock";

beforeEach(() => vi.useFakeTimers());
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
    expect(store.getState().error).toBe("boom");
  });

  it("surfaces an error if loading the note list fails", async () => {
    const { client, store } = setup();
    vi.spyOn(client, "runQuery").mockRejectedValueOnce({
      type: "internal",
      message: "boom",
    });
    await store.getState().init();
    expect(store.getState().error).toBe("boom");
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

  it("defaults the editor to the rendered view", () => {
    expect(DEFAULT_SETTINGS.editorMode).toBe("rendered");
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
    };
    const store = createCairnStore(client, host);
    await store.getState().init();
    expect(store.getState().cairnPath).toBeNull();
    await store.getState().openCairn();
    expect(store.getState().cairnPath).toBe("/tmp/mycairn");
    expect(store.getState().notePaths).toContain("x.md");
  });
});
