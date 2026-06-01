import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invoke(...a),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...a: unknown[]) => listen(...a),
}));

import { TauriClient, TauriHost } from "./tauri";

beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
});

describe("TauriClient", () => {
  it("sendCommand invokes send_command and returns the response", async () => {
    invoke.mockResolvedValueOnce({ type: "done" });
    const c = new TauriClient();
    const res = await c.sendCommand({
      type: "write_note",
      path: "a.md",
      contents: "x",
    });
    expect(invoke).toHaveBeenCalledWith("send_command", {
      command: { type: "write_note", path: "a.md", contents: "x" },
    });
    expect(res).toEqual({ type: "done" });
  });

  it("runQuery invokes run_query", async () => {
    invoke.mockResolvedValueOnce({ type: "paths", paths: ["a.md"] });
    const c = new TauriClient();
    const res = await c.runQuery({ type: "search", query: "x" });
    expect(invoke).toHaveBeenCalledWith("run_query", {
      query: { type: "search", query: "x" },
    });
    expect(res).toEqual({ type: "paths", paths: ["a.md"] });
  });

  it("subscribe forwards event payloads and returns an unlisten", async () => {
    const unlisten = vi.fn();
    let handler: (e: { payload: unknown }) => void = () => {};
    listen.mockImplementationOnce(
      (_name: string, h: (e: { payload: unknown }) => void) => {
        handler = h;
        return Promise.resolve(unlisten);
      },
    );
    const c = new TauriClient();
    const cb = vi.fn();
    const unsub = c.subscribe(cb);
    handler({ payload: { type: "committed", commit: "c1" } });
    expect(cb).toHaveBeenCalledWith({ type: "committed", commit: "c1" });
    unsub();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalled();
  });
});

describe("TauriHost", () => {
  it("openCairn invokes pick_and_open_cairn", async () => {
    invoke.mockResolvedValueOnce("/tmp/c");
    expect(await new TauriHost().openCairn()).toBe("/tmp/c");
    expect(invoke).toHaveBeenCalledWith("pick_and_open_cairn");
  });

  it("currentCairn invokes current_cairn", async () => {
    invoke.mockResolvedValueOnce(null);
    expect(await new TauriHost().currentCairn()).toBeNull();
    expect(invoke).toHaveBeenCalledWith("current_cairn");
  });
});
