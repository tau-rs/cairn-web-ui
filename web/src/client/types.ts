import type {
  Command,
  Query,
  Event,
  CommandResponse,
  QueryResponse,
  AskRequest,
  AnswerEvent,
} from "../contract";

export type Unsubscribe = () => void;

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
   *  offer a manual refresh. The mock never errors. */
  subscribe(
    cb: (e: Event) => void,
    onError?: (err: unknown) => void,
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
}
