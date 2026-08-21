import type {
  Event,
  CommandResponse,
  QueryResponse,
  AnswerEvent,
  CollabServerMsg,
} from "../contract";

/** The known discriminant tags for each contract union. Kept in lockstep with
 *  the vendored contract; the DX3 drift check guards the contract itself, and
 *  an unknown tag here means engine↔UI contract drift (S5). */
const EVENT_TYPES = [
  "note_changed",
  "note_deleted",
  "committed",
  "reindexed",
] as const;
const COMMAND_RESPONSE_TYPES = ["done", "committed", "plugin_result"] as const;
const QUERY_RESPONSE_TYPES = [
  "note",
  "paths",
  "search_results",
  "notes",
  "graph",
  "tags",
  "plugins",
  "history",
] as const;
const ANSWER_EVENT_TYPES = [
  "sources",
  "text_delta",
  "tool_started",
  "tool_completed",
  "turn_completed",
  "completed",
  "failed",
] as const;
const COLLAB_SERVER_MSG_TYPES = [
  "joined",
  "snapshot",
  "op",
  "error",
  "recoverable",
] as const;

/** Raised when a value crossing the backend boundary doesn't carry a known
 *  discriminant `type`. Thin by design (S5): we tag-check the union, not the
 *  inner fields — a full schema rebuild is out of scope. */
export class ContractShapeError extends Error {
  constructor(what: string, got: unknown) {
    const tag =
      typeof got === "string" ? JSON.stringify(got) : "missing/invalid `type`";
    super(`Malformed ${what} from backend: unexpected ${tag}`);
    this.name = "ContractShapeError";
  }
}

function tagOf(x: unknown): string | undefined {
  if (typeof x !== "object" || x === null) return undefined;
  const t = (x as { type?: unknown }).type;
  return typeof t === "string" ? t : undefined;
}

function assertTagged<T>(
  x: unknown,
  allowed: readonly string[],
  what: string,
): T {
  const tag = tagOf(x);
  if (tag === undefined || !allowed.includes(tag)) {
    throw new ContractShapeError(what, tag);
  }
  return x as T;
}

export const assertEvent = (x: unknown): Event =>
  assertTagged(x, EVENT_TYPES, "event");
export const assertCommandResponse = (x: unknown): CommandResponse =>
  assertTagged(x, COMMAND_RESPONSE_TYPES, "command response");
export const assertQueryResponse = (x: unknown): QueryResponse =>
  assertTagged(x, QUERY_RESPONSE_TYPES, "query response");
export const assertAnswerEvent = (x: unknown): AnswerEvent =>
  assertTagged(x, ANSWER_EVENT_TYPES, "answer event");
export const assertCollabServerMsg = (x: unknown): CollabServerMsg =>
  assertTagged(x, COLLAB_SERVER_MSG_TYPES, "collab server message");
