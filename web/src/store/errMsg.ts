import type { ContractError } from "../contract";

/** Format an error for display. A `ContractError` (the typed Err a client
 *  rejects with) is a tagged object; anything else falls back to its `message`
 *  or string form. Shared by the store and the ask slice so a client rejection
 *  surfaces identically wherever it lands. */
export function errMsg(err: unknown): string {
  // ContractError (rejected by the client) is a tagged object.
  if (err && typeof err === "object" && "type" in err) {
    const e = err as ContractError;
    if (e.type === "not_found") return `Not found: ${e.what}`;
    return e.message;
  }
  return err instanceof Error ? err.message : String(err);
}
