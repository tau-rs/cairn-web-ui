import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnswerEvent } from "../contract";

const invoke = vi.fn();
const listen = vi.fn();

/** Minimal stand-in for Tauri's IPC `Channel`: the Rust side calls `.send(e)`,
 *  which the runtime delivers to `onmessage`. A test grabs the instance the
 *  client passed to `invoke` and drives frames through `onmessage`. */
interface FakeChannel<T> {
  onmessage: (m: T) => void;
}
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invoke(...a),
  convertFileSrc: (p: string) => "asset://" + p,
  // Defined inline: vi.mock is hoisted above any top-level class/const.
  Channel: class {
    onmessage: (m: unknown) => void = () => {};
  },
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...a: unknown[]) => listen(...a),
}));

import { TauriClient, TauriHost } from "./tauri";

/** Drive `ask`, capturing the `Channel` the client passed to `invoke("ask", …)`
 *  so the test can replay frames through it. */
function startAsk(
  client: TauriClient,
  onError?: (e: unknown) => void,
): {
  channel: FakeChannel<AnswerEvent>;
  got: AnswerEvent[];
  unsub: () => void;
} {
  let channel: FakeChannel<AnswerEvent> | undefined;
  invoke.mockImplementationOnce(
    (_cmd: string, args: Record<string, unknown>) => {
      channel = args.channel as FakeChannel<AnswerEvent>;
      return new Promise<void>(() => {}); // pending until the run ends
    },
  );
  const got: AnswerEvent[] = [];
  const unsub = client.ask(
    { query: "q", top_k: null },
    (e) => got.push(e),
    onError,
  );
  return { channel: channel as FakeChannel<AnswerEvent>, got, unsub };
}

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

  it("openRecovery rejects (collab is daemon-only)", async () => {
    const c = new TauriClient();
    await expect(c.openRecovery("x.md")).rejects.toThrow(/collab/i);
  });

  it("openCollab is an honest daemon-only stub", () => {
    const client = new TauriClient();
    let err: string | null = null;
    const session = client.openCollab("n.md", {
      onError: (_note, message) => (err = message),
    });
    expect(typeof session.close).toBe("function");
    expect(err).toMatch(/daemon/i);
    session.close(); // no throw
  });
});

describe("TauriClient.ask", () => {
  it("invokes ask with the request + a channel and streams sources -> deltas -> completed in order", () => {
    const c = new TauriClient();
    const { channel, got } = startAsk(c);
    expect(invoke).toHaveBeenCalledWith(
      "ask",
      expect.objectContaining({ request: { query: "q", top_k: null } }),
    );
    channel.onmessage({ type: "sources", paths: ["a.md", "b.md"] });
    channel.onmessage({ type: "text_delta", text: "Hello " });
    channel.onmessage({ type: "text_delta", text: "world" });
    channel.onmessage({ type: "completed" });
    expect(got.map((e) => e.type)).toEqual([
      "sources",
      "text_delta",
      "text_delta",
      "completed",
    ]);
    expect(got[0]).toEqual({ type: "sources", paths: ["a.md", "b.md"] });
  });

  it("delivers an in-run failed frame as an event, not via onError", () => {
    const c = new TauriClient();
    const onError = vi.fn();
    const { channel, got } = startAsk(c, onError);
    channel.onmessage({ type: "sources", paths: [] });
    channel.onmessage({ type: "failed", message: "tau not configured" });
    expect(got[got.length - 1]).toEqual({
      type: "failed",
      message: "tau not configured",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("routes a pre-stream invoke rejection to onError", async () => {
    invoke.mockRejectedValueOnce({ type: "internal", message: "boom" });
    const c = new TauriClient();
    const onError = vi.fn();
    c.ask({ query: "q", top_k: null }, vi.fn(), onError);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith({ type: "internal", message: "boom" });
  });

  it("treats a malformed frame as fatal: onError once, and no further frames stream (matches DaemonClient)", () => {
    const c = new TauriClient();
    const onError = vi.fn();
    const { channel, got } = startAsk(c, onError);
    channel.onmessage({ type: "garbage" } as unknown as AnswerEvent);
    // A later, well-formed frame must NOT reach onEvent — a malformed frame is a
    // backend contract violation that ends the stream, like DaemonClient.ask.
    channel.onmessage({ type: "completed" });
    expect(got).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0])).toMatch(/Malformed answer event/);
  });

  it("stops forwarding frames after unsubscribe", () => {
    const c = new TauriClient();
    const { channel, got, unsub } = startAsk(c);
    channel.onmessage({ type: "sources", paths: [] });
    unsub();
    channel.onmessage({ type: "text_delta", text: "late" });
    channel.onmessage({ type: "completed" });
    expect(got.map((e) => e.type)).toEqual(["sources"]);
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
