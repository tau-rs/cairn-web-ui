import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invoke(...a),
  convertFileSrc: (p: string) => "asset://" + p,
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

  it("subscribe reports a listen-registration failure via onError instead of an unhandled rejection", async () => {
    const boom = new Error("attach failed");
    listen.mockImplementationOnce(() => Promise.reject(boom));
    const c = new TauriClient();
    const onError = vi.fn();
    c.subscribe(vi.fn(), onError);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("runQuery rejects a malformed response with a clear error", async () => {
    invoke.mockResolvedValueOnce({ type: "not_a_real_query_response" });
    const c = new TauriClient();
    await expect(c.runQuery({ type: "list_notes" })).rejects.toThrow(
      /Malformed query response/,
    );
  });

  it("sendCommand rejects a malformed response with a clear error", async () => {
    invoke.mockResolvedValueOnce({ nope: true });
    const c = new TauriClient();
    await expect(
      c.sendCommand({ type: "write_note", path: "a.md", contents: "x" }),
    ).rejects.toThrow(/Malformed command response/);
  });

  it("subscribe routes a malformed event payload to onError and never calls cb", async () => {
    let handler: (e: { payload: unknown }) => void = () => {};
    listen.mockImplementationOnce(
      (_name: string, h: (e: { payload: unknown }) => void) => {
        handler = h;
        return Promise.resolve(vi.fn());
      },
    );
    const c = new TauriClient();
    const cb = vi.fn();
    const onError = vi.fn();
    c.subscribe(cb, onError);
    handler({ payload: { type: "garbage" } });
    expect(cb).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0])).toMatch(/Malformed event/);
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

  it("assetUrl returns the input path when no root is set", () => {
    expect(new TauriHost().assetUrl("img/x.png")).toBe("img/x.png");
  });

  it("assetUrl resolves a local path via convertFileSrc once a root is open", async () => {
    invoke.mockResolvedValueOnce("/tmp/c");
    const h = new TauriHost();
    await h.openCairn();
    expect(h.assetUrl("img/x.png")).toBe("asset:///tmp/c/img/x.png");
  });

  it("assetUrl refuses a path that escapes the vault root", async () => {
    invoke.mockResolvedValueOnce("/tmp/c");
    const h = new TauriHost();
    await h.openCairn();
    expect(h.assetUrl("../../etc/passwd")).toBe("");
  });

  it("assetUrl refuses an absolute path", async () => {
    invoke.mockResolvedValueOnce("/tmp/c");
    const h = new TauriHost();
    await h.openCairn();
    expect(h.assetUrl("/etc/passwd")).toBe("");
  });

  it("assetUrl normalizes a safe interior `..` before resolving", async () => {
    invoke.mockResolvedValueOnce("/tmp/c");
    const h = new TauriHost();
    await h.openCairn();
    expect(h.assetUrl("a/../img/x.png")).toBe("asset:///tmp/c/img/x.png");
  });
});
