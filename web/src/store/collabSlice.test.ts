import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCairnStore } from "./store";
import { MockClient } from "../client/mock";

const wireOp = {
  op: "delete",
  id: { replica: 9, counter: 1 },
  lamport: 3,
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

  it("collabReloadNow reloads and clears pendingCount", async () => {
    const { client, store } = make();
    await store.getState().openNote("n.md");
    store.getState().editBuffer("# N\nedited");
    store.getState().collabFollow("n.md");
    client.mockCollabHandlers!.onForeignOp!("n.md", wireOp);
    const reload = vi.spyOn(store.getState(), "reloadNoteBuffer");
    store.getState().collabReloadNow();
    expect(reload).toHaveBeenCalledWith("n.md");
    expect(store.getState().collab.pendingCount).toBe(0);
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
