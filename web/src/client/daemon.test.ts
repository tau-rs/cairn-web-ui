import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DaemonClient,
  DaemonHost,
  backoffDelay,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
} from "./daemon";

// ── A controllable fake WebSocket ───────────────────────────────────────────
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emitOpen() {
    this.onopen?.(undefined);
  }
  emitMessage(data: unknown) {
    this.onmessage?.({ data });
  }
  emitClose() {
    this.onclose?.(undefined);
  }
  static last() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }
  static reset() {
    FakeWebSocket.instances = [];
  }
}

const URL = "http://localhost:7777";
const WS = FakeWebSocket as unknown as { new (url: string): WebSocket };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => FakeWebSocket.reset());

describe("DaemonClient HTTP", () => {
  it("sendCommand POSTs to /command with the bearer header and returns the response", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ type: "done" }));
    const c = new DaemonClient({
      url: URL,
      token: "secret",
      fetch,
      WebSocket: WS,
    });
    const res = await c.sendCommand({
      type: "write_note",
      path: "a.md",
      contents: "x",
    });
    expect(res).toEqual({ type: "done" });
    expect(fetch).toHaveBeenCalledWith("http://localhost:7777/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      },
      body: JSON.stringify({ type: "write_note", path: "a.md", contents: "x" }),
    });
  });

  it("runQuery POSTs to /query", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ type: "paths", paths: ["a.md"] }));
    const c = new DaemonClient({
      url: URL,
      token: "secret",
      fetch,
      WebSocket: WS,
    });
    const res = await c.runQuery({ type: "get_backlinks", path: "a.md" });
    expect(res).toEqual({ type: "paths", paths: ["a.md"] });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:7777/query",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("omits the Authorization header when no token is configured", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ type: "done" }));
    const c = new DaemonClient({ url: URL, fetch, WebSocket: WS });
    await c.sendCommand({ type: "commit", message: "m" });
    const headers = fetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("rejects a ContractError body with that typed error (matching mock/tauri)", async () => {
    const err = { type: "not_found", what: "missing.md" };
    const fetch = vi.fn().mockResolvedValue(jsonResponse(err, 404));
    const c = new DaemonClient({ url: URL, fetch, WebSocket: WS });
    await expect(
      c.runQuery({ type: "get_note", path: "missing.md" }),
    ).rejects.toEqual(err);
  });

  it("rejects a 401 with an unauthorized error", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    const c = new DaemonClient({
      url: URL,
      token: "bad",
      fetch,
      WebSocket: WS,
    });
    await expect(c.runQuery({ type: "list_notes" })).rejects.toThrow(
      /unauthor/i,
    );
  });

  it("rejects a malformed 2xx body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ type: "not_a_real_response" }));
    const c = new DaemonClient({ url: URL, fetch, WebSocket: WS });
    await expect(c.runQuery({ type: "list_notes" })).rejects.toThrow(
      /Malformed query response/,
    );
  });

  it("noteTags derives tags from list_notes", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        type: "notes",
        notes: [
          { path: "a.md", title: "A", tags: ["rust"] },
          { path: "b.md", title: "B", tags: [] },
        ],
      }),
    );
    const c = new DaemonClient({ url: URL, fetch, WebSocket: WS });
    expect(await c.noteTags()).toEqual({ "a.md": ["rust"], "b.md": [] });
  });
});

describe("DaemonClient subscribe", () => {
  it("connects to the ws:// events endpoint and forwards parsed events", () => {
    const c = new DaemonClient({ url: URL, fetch: vi.fn(), WebSocket: WS });
    const cb = vi.fn();
    c.subscribe(cb);
    const sock = FakeWebSocket.last();
    expect(sock.url).toBe("ws://localhost:7777/events");
    sock.emitMessage(JSON.stringify({ type: "committed", commit: "c1" }));
    expect(cb).toHaveBeenCalledWith({ type: "committed", commit: "c1" });
  });

  it("derives wss:// from an https daemon url", () => {
    const c = new DaemonClient({
      url: "https://cairn.example.com",
      fetch: vi.fn(),
      WebSocket: WS,
    });
    c.subscribe(vi.fn());
    expect(FakeWebSocket.last().url).toBe("wss://cairn.example.com/events");
  });

  it("routes a malformed frame to onError and never calls cb", () => {
    const c = new DaemonClient({ url: URL, fetch: vi.fn(), WebSocket: WS });
    const cb = vi.fn();
    const onError = vi.fn();
    c.subscribe(cb, onError);
    FakeWebSocket.last().emitMessage(JSON.stringify({ type: "garbage" }));
    expect(cb).not.toHaveBeenCalled();
    expect(String(onError.mock.calls[0][0])).toMatch(/Malformed event/);
  });

  it("unsubscribe closes the socket and stops reconnecting", () => {
    vi.useFakeTimers();
    const c = new DaemonClient({
      url: URL,
      fetch: vi.fn(),
      WebSocket: WS,
      random: () => 1,
    });
    const unsub = c.subscribe(vi.fn());
    const sock = FakeWebSocket.last();
    unsub();
    expect(sock.closed).toBe(true);
    sock.emitClose();
    vi.advanceTimersByTime(RECONNECT_MAX_MS);
    expect(FakeWebSocket.instances).toHaveLength(1); // no reconnect after unsub
    vi.useRealTimers();
  });

  describe("reconnect/backoff (B′)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("silently reconnects on a drop without nagging on the first blip", () => {
      const onError = vi.fn();
      const c = new DaemonClient({
        url: URL,
        fetch: vi.fn(),
        WebSocket: WS,
        random: () => 1,
      });
      c.subscribe(vi.fn(), onError);
      FakeWebSocket.last().emitClose(); // first drop
      expect(onError).not.toHaveBeenCalled(); // no nag yet
      vi.advanceTimersByTime(backoffDelay(1));
      expect(FakeWebSocket.instances).toHaveLength(2); // reconnected
    });

    it("escalates to onError only after sustained failure", () => {
      const onError = vi.fn();
      const c = new DaemonClient({
        url: URL,
        fetch: vi.fn(),
        WebSocket: WS,
        random: () => 1,
      });
      c.subscribe(vi.fn(), onError);
      // Each reconnect immediately drops again → keep failing.
      for (let i = 1; i <= 4; i++) {
        FakeWebSocket.last().emitClose();
        vi.advanceTimersByTime(backoffDelay(i));
      }
      expect(onError).toHaveBeenCalled();
    });

    it("resets the backoff after a successful reconnect", () => {
      const c = new DaemonClient({
        url: URL,
        fetch: vi.fn(),
        WebSocket: WS,
        random: () => 1,
      });
      c.subscribe(vi.fn());
      FakeWebSocket.last().emitClose();
      vi.advanceTimersByTime(backoffDelay(1));
      FakeWebSocket.last().emitOpen(); // healed → attempt counter resets
      FakeWebSocket.last().emitClose(); // next drop starts from attempt 1 again
      vi.advanceTimersByTime(backoffDelay(1));
      expect(FakeWebSocket.instances).toHaveLength(3);
    });
  });
});

describe("backoffDelay", () => {
  it("doubles from the base and caps at the max", () => {
    expect(backoffDelay(1)).toBe(RECONNECT_BASE_MS);
    expect(backoffDelay(2)).toBe(RECONNECT_BASE_MS * 2);
    expect(backoffDelay(3)).toBe(RECONNECT_BASE_MS * 4);
    expect(backoffDelay(99)).toBe(RECONNECT_MAX_MS);
  });
});

describe("DaemonHost", () => {
  it("reports the daemon url as the open cairn", async () => {
    const h = new DaemonHost(URL);
    expect(await h.currentCairn()).toBe(URL);
    expect(await h.openCairn()).toBe(URL);
  });

  it("passes remote and data urls through but returns local paths unresolved", () => {
    const h = new DaemonHost(URL);
    expect(h.assetUrl("https://x/y.png")).toBe("https://x/y.png");
    expect(h.assetUrl("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(h.assetUrl("img/local.png")).toBe("img/local.png");
  });
});
