import type {
  Command,
  Query,
  Event,
  CommandResponse,
  QueryResponse,
  AskRequest,
  AnswerEvent,
} from "../contract";
import type { CairnClient, Unsubscribe } from "./types";
import type { CairnHost } from "./host";
import {
  assertEvent,
  assertCommandResponse,
  assertQueryResponse,
  assertAnswerEvent,
} from "./contractGuards";

/** Exponential-backoff reconnect, per the standard WebSocket guidance: start at
 *  500ms, double each attempt, cap at 30s, with full jitter applied at the call
 *  site. `backoffDelay` is the deterministic ceiling for attempt `n` (1-based);
 *  jitter (`random() * ceiling`) is layered on in `subscribe`. */
export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 30_000;
/** Reconnect this many times silently before surfacing a degraded state via
 *  `onError` (the store's "live updates unavailable" banner). A brief blip
 *  heals before the user is ever nagged; sustained failure still surfaces. */
export const ESCALATE_AFTER_ATTEMPTS = 4;

export function backoffDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
}

const CONTRACT_ERROR_TYPES = ["not_found", "invalid_request", "internal"];

/** Is `x` a contract `ContractError` body? We reject with it verbatim so the
 *  store sees the same typed error mock/tauri produce. */
function isContractError(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { type?: unknown }).type === "string" &&
    CONTRACT_ERROR_TYPES.includes((x as { type: string }).type)
  );
}

export interface DaemonClientOptions {
  /** Base HTTP URL of the daemon, e.g. `http://localhost:7777`. */
  url: string;
  /** Bearer token; when set, sent as `Authorization: Bearer <token>`. */
  token?: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Injectable for tests; defaults to the global `WebSocket`. */
  WebSocket?: { new (url: string): WebSocket };
  /** Injectable jitter source for tests; defaults to `Math.random`. */
  random?: () => number;
}

/** Talks to a running `cairn-daemon` over HTTP (`/command`, `/query`) + a
 *  WebSocket event stream (`/events`). Rejections are the contract's
 *  `ContractError` on typed failures, matching MockClient/TauriClient. */
export class DaemonClient implements CairnClient {
  private readonly url: string;
  private readonly token?: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly WS: { new (url: string): WebSocket };
  private readonly random: () => number;

  constructor(opts: DaemonClientOptions) {
    // Trim a trailing slash so `${url}/command` never doubles up.
    this.url = opts.url.replace(/\/+$/, "");
    this.token = opts.token || undefined;
    this.fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.WS = opts.WebSocket ?? globalThis.WebSocket;
    this.random = opts.random ?? Math.random;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async post(path: string, body: Command | Query): Promise<unknown> {
    const res = await this.fetch(`${this.url}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await this.errorFor(res);
    return res.json();
  }

  /** Map a non-2xx response to a rejection: the typed `ContractError` body when
   *  present, else a generic error (401 → unauthorized). */
  private async errorFor(res: Response): Promise<unknown> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON body (e.g. an empty 401) — fall through to a generic error.
    }
    if (isContractError(body)) return body;
    if (res.status === 401) {
      return new Error("unauthorized: the daemon rejected the bearer token");
    }
    return new Error(`daemon request failed: ${res.status}`);
  }

  async sendCommand(command: Command): Promise<CommandResponse> {
    return assertCommandResponse(await this.post("/command", command));
  }

  async runQuery(query: Query): Promise<QueryResponse> {
    return assertQueryResponse(await this.post("/query", query));
  }

  /** Stream a note-grounded answer from `POST /ask` (SSE over POST). The first
   *  frame is `sources`, then `text_delta`/`tool_*`, then a terminal
   *  `completed`/`failed`. A pre-stream failure is an HTTP error -> `onError`
   *  (the typed `ContractError`/401); an in-run failure arrives as a `failed`
   *  event. `EventSource` can't carry the bearer token, so we read the body via
   *  `fetch` + `ReadableStream`. Unsubscribe drops further events and cancels
   *  the reader; the server run finishes harmlessly (no v1 cancel endpoint). */
  ask(
    req: AskRequest,
    onEvent: (e: AnswerEvent) => void,
    onError?: (err: unknown) => void,
  ): Unsubscribe {
    let cancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    // Async IIFE so the returned `unsub` is assigned before any onEvent fires
    // (the ask slice relies on this).
    void (async () => {
      let res: Response;
      try {
        res = await this.fetch(`${this.url}/ask`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(req),
        });
      } catch (err) {
        if (!cancelled) onError?.(err);
        return;
      }
      if (cancelled) return;
      if (!res.ok || !res.body) {
        if (!cancelled) onError?.(await this.errorFor(res));
        return;
      }
      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (cancelled) return;
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          // SSE frames are separated by a blank line.
          while ((sep = buf.indexOf("\n\n")) !== -1) {
            const raw = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const e = parseSseFrame(raw);
            if (e !== null && !cancelled) onEvent(assertAnswerEvent(e));
          }
        }
        // Flush a trailing frame with no blank-line terminator.
        const tail = parseSseFrame(buf);
        if (tail !== null && !cancelled) onEvent(assertAnswerEvent(tail));
      } catch (err) {
        if (!cancelled) onError?.(err);
      }
    })();

    return () => {
      cancelled = true;
      void reader?.cancel().catch(() => {});
    };
  }

  subscribe(
    cb: (e: Event) => void,
    onError?: (err: unknown) => void,
  ): Unsubscribe {
    const eventsUrl = this.url.replace(/^http/, "ws") + "/events";
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const scheduleReconnect = (err: unknown) => {
      if (closed) return;
      attempt += 1;
      // Stay silent for brief blips; surface a degraded state only once the
      // socket has clearly failed to come back (B′). A successful reconnect
      // resets `attempt`, so transient drops never reach here.
      if (attempt >= ESCALATE_AFTER_ATTEMPTS) onError?.(err);
      // Full jitter over the capped exponential ceiling.
      timer = setTimeout(connect, this.random() * backoffDelay(attempt));
    };

    const connect = () => {
      let sock: WebSocket;
      try {
        sock = new this.WS(eventsUrl);
      } catch (err) {
        scheduleReconnect(err);
        return;
      }
      ws = sock;
      sock.onopen = () => {
        attempt = 0;
      };
      sock.onmessage = (ev: { data: unknown }) => {
        try {
          const text = typeof ev.data === "string" ? ev.data : String(ev.data);
          cb(assertEvent(JSON.parse(text)));
        } catch (err) {
          onError?.(err);
        }
      };
      sock.onclose = () => {
        if (!closed) scheduleReconnect(new Error("event channel closed"));
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }

  async noteTags(): Promise<Record<string, string[]>> {
    const res = await this.runQuery({ type: "list_notes" });
    if (res.type !== "notes") return {};
    return Object.fromEntries(res.notes.map((n) => [n.path, n.tags]));
  }
}

/** Extract the JSON payload from one SSE frame: concatenate its `data:` lines
 *  (ignoring comments/blank/`event:` lines), or null if the frame has no data. */
function parseSseFrame(raw: string): unknown {
  const data = raw
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).replace(/^ /, ""))
    .join("\n");
  if (data === "") return null;
  return JSON.parse(data);
}

/** App-level cairn lifecycle for daemon mode. There is no browser file picker
 *  and the daemon serves one fixed cairn, so `currentCairn`/`openCairn` report
 *  the daemon URL as the open-cairn label. The daemon exposes no asset route,
 *  so local image paths can't be resolved — the broken-image fallback covers
 *  them; remote (`http(s):`) and `data:` URLs pass through. */
export class DaemonHost implements CairnHost {
  constructor(private readonly url: string) {}
  currentCairn(): Promise<string | null> {
    return Promise.resolve(this.url);
  }
  openCairn(): Promise<string | null> {
    return Promise.resolve(this.url);
  }
  assetUrl(relPath: string): string {
    return relPath;
  }
}
