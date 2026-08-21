import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCairnStore } from "./store";
import { MockClient } from "../client/mock";

const wireOp = {
  op: "delete",
  id: { replica: "9", counter: "1" },
  lamport: "3",
} as never;

const make = () => {
  const client = new MockClient({ "n.md": "# N\n", "m.md": "# M\n" });
  const store = createCairnStore(client);
  return { client, store };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("collab slice", () => {
  it("follow opens a session and sets the followed note", () => {
    const { store } = make();
    store.getState().collabFollow("n.md");
    expect(store.getState().collab.note).toBe("n.md");
    expect(store.getState().collab.live).toBe(false);
  });

  it("a foreign op marks live and decays after LIVE_DECAY_MS", () => {
    const { client, store } = make();
    store.getState().collabFollow("n.md");
    client.mockCollabHandlers!.onForeignOp!("n.md", wireOp);
    expect(store.getState().collab.live).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(store.getState().collab.live).toBe(false);
  });

  it("clean buffer: a foreign op debounce-reloads and does not bump pendingCount", () => {
    const { client, store } = make();
    const reload = vi.spyOn(store.getState(), "reloadNoteBuffer");
    store.getState().collabFollow("n.md"); // buffer for n.md is clean (not opened/edited)
    client.mockCollabHandlers!.onForeignOp!("n.md", wireOp);
    expect(store.getState().collab.pendingCount).toBe(0);
    vi.advanceTimersByTime(300);
    expect(reload).toHaveBeenCalledWith("n.md");
  });

  it("dirty buffer: a foreign op bumps pendingCount and does NOT reload", async () => {
    const { client, store } = make();
    // Make n.md dirty via the store's edit path.
    await store.getState().openNote("n.md");
    store.getState().editBuffer("# N\nedited");
    const reload = vi.spyOn(store.getState(), "reloadNoteBuffer");
    store.getState().collabFollow("n.md");
    client.mockCollabHandlers!.onForeignOp!("n.md", wireOp);
    expect(store.getState().collab.pendingCount).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(reload).not.toHaveBeenCalled();
  });

  it("collabReloadNow force-replaces a dirty buffer from disk and clears pendingCount", async () => {
    const { client, store } = make();
    await store.getState().openNote("n.md");
    store.getState().editBuffer("# N\nedited");
    store.getState().collabFollow("n.md");
    client.mockCollabHandlers!.onForeignOp!("n.md", wireOp);
    expect(store.getState().openNotes["n.md"].dirty).toBe(true);
    expect(store.getState().collab.pendingCount).toBe(1);

    store.getState().collabReloadNow();

    // collabReloadNow is async internally (get_note resolves on a
    // microtask); switch off fake timers so the pending microtask can
    // actually flush while we wait for it.
    vi.useRealTimers();
    await vi.waitFor(() =>
      expect(store.getState().openNotes["n.md"].dirty).toBe(false),
    );
    expect(store.getState().openNotes["n.md"].contents).toBe("# N\n");
    expect(store.getState().collab.pendingCount).toBe(0);
    vi.useFakeTimers();
  });

  it("switching the followed note closes an open reload-confirm dialog", () => {
    const { store } = make();
    store.getState().collabFollow("n.md");
    store.getState().setUi({ collabReloadConfirmOpen: true });
    store.getState().collabFollow("m.md"); // switch notes mid-confirm
    expect(store.getState().ui.collabReloadConfirmOpen).toBe(false);
  });

  it("collabStop closes an open reload-confirm dialog", () => {
    const { store } = make();
    store.getState().collabFollow("n.md");
    store.getState().setUi({ collabReloadConfirmOpen: true });
    store.getState().collabStop();
    expect(store.getState().ui.collabReloadConfirmOpen).toBe(false);
  });

  it("collabReloadNow is a no-op with no followed note", () => {
    const { store } = make();
    expect(() => store.getState().collabReloadNow()).not.toThrow();
  });

  it("collabReloadNow is token-guarded against a note switch mid-fetch", async () => {
    const { client, store } = make();
    await store.getState().openNote("n.md");
    store.getState().editBuffer("# N\nedited");
    store.getState().collabFollow("n.md");
    client.mockCollabHandlers!.onForeignOp!("n.md", wireOp);

    store.getState().collabReloadNow(); // in-flight get_note for n.md
    store.getState().collabFollow("m.md"); // supersedes before get_note resolves

    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    // The superseded reload must not resurrect n.md's pendingCount/dirty
    // state or otherwise mutate current (m.md) presence.
    expect(store.getState().collab.note).toBe("m.md");
    expect(store.getState().openNotes["n.md"].dirty).toBe(true);
    vi.useFakeTimers();
  });

  it("switching notes drops a stale session's callbacks", () => {
    const { client, store } = make();
    store.getState().collabFollow("n.md");
    const staleHandlers = client.mockCollabHandlers!;
    store.getState().collabFollow("m.md"); // supersedes; token advances
    staleHandlers.onForeignOp!("n.md", wireOp); // late callback from the old session
    expect(store.getState().collab.note).toBe("m.md");
    expect(store.getState().collab.live).toBe(false); // stale op ignored
  });

  it("collabStop resets to the default presence", () => {
    const { store } = make();
    store.getState().collabFollow("n.md");
    store.getState().collabStop();
    expect(store.getState().collab).toEqual({
      note: null,
      live: false,
      pendingCount: 0,
    });
  });
});
