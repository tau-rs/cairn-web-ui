import type { Command, Query, Event, CommandResponse, QueryResponse } from "../contract";

export type Unsubscribe = () => void;

/**
 * The single transport-abstracted contract the whole UI is written against.
 * `sendCommand`/`runQuery` reject with a `ContractError` (from "../contract")
 * on failure — the same typed error the daemon and cairn-service produce.
 */
export interface CairnClient {
  sendCommand(c: Command): Promise<CommandResponse>;
  runQuery(q: Query): Promise<QueryResponse>;
  subscribe(cb: (e: Event) => void): Unsubscribe;
}
