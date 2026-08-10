import type {
  Command,
  Query,
  Event,
  CommandResponse,
  QueryResponse,
  AskRequest,
  AnswerEvent,
  WireRecoverableBlock,
  WireBlockId,
} from "../contract";

export type Unsubscribe = () => void;

/** A live `/collab` recovery session for one note: retained blocks plus a
 *  handle to restore a chosen version or leave the session. */
export interface RecoverySession {
  /** Retained blocks for the note (raw wire; filter with toRecoveryItems). */
  blocks: WireRecoverableBlock[];
  /** Restore a chosen version; resolves once the effect is observed
   *  (Daemon: the fanned-out Insert op; Mock: immediately). */
  restore(id: WireBlockId, versionIndex: number): Promise<void>;
  /** Leave the /collab session and close the socket. */
  close(): void;
}

/**
 * The single transport-abstracted contract the whole UI is written against.
 * `sendCommand`/`runQuery` reject with a `ContractError` (from "../contract")
 * on failure — the same typed error the daemon and cairn-service produce.
 */
export interface CairnClient {
  sendCommand(c: Command): Promise<CommandResponse>;
  runQuery(q: Query): Promise<QueryResponse>;
  /** Subscribe to push events. `onError` fires if the channel fails to attach,
   *  so the UI can surface a degraded "live updates unavailable" state and
   *  offer a manual refresh. The mock never errors. `onStatus` is an optional
   *  transient signal for transports that reconnect: `"reconnecting"` during
   *  silent backoff (before `onError` escalation), `"live"` on a successful
   *  (re)open. Transports with no reconnect concept never call it. */
  subscribe(
    cb: (e: Event) => void,
    onError?: (err: unknown) => void,
    onStatus?: (s: "reconnecting" | "live") => void,
  ): Unsubscribe;
  /** All notes' tags (path → tags). Client-level capability (not a contract
   *  Query): the mock parses note content; Tauri stubs {} until the engine
   *  exposes tags. */
  noteTags(): Promise<Record<string, string[]>>;
  /** Stream a note-grounded answer. `onEvent` receives `AnswerEvent` frames
   *  (`sources` first, then deltas/tool events, then `completed`/`failed`).
   *  `onError` fires only on a pre-stream/transport failure; an in-run failure
   *  is a `failed` event. The returned `Unsubscribe` cancels the stream. */
  ask(
    req: AskRequest,
    onEvent: (e: AnswerEvent) => void,
    onError?: (err: unknown) => void,
  ): Unsubscribe;
  /** Open a /collab recovery session for `note`: join, request `recover`,
   *  resolve with retained blocks + a handle to restore/close. Rejects when
   *  the transport has no collab session (Tauri stub). */
  openRecovery(note: string): Promise<RecoverySession>;
}
