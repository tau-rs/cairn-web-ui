import type {
  Command,
  Query,
  Event,
  CommandResponse,
  QueryResponse,
} from "../contract";
import type { AgentEvent } from "./agent";

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
  /** Ask the grounded agent a question; `onEvent` receives the stream (see
   *  AgentEvent). Mirrors `subscribe`'s shape: `onError` fires if the stream
   *  fails to attach. Returns an Unsubscribe that cancels the in-flight run.
   *  The real transport is wired in Wave 2 (Track 03); the mock streams now. */
  ask(
    question: string,
    onEvent: (e: AgentEvent) => void,
    onError?: (err: unknown) => void,
  ): Unsubscribe;
}
