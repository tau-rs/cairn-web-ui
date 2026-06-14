/** A streaming agent event. Mirrors the engine's `AgentEvent` (Track 03), which
 *  is `#[non_exhaustive]` — consumers MUST ignore unknown `type` values rather
 *  than crash. Citations are not a separate variant: the engine embeds cited
 *  notes as `[[stem]]` wikilinks inside `text_delta` text. */
export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; tool: string }
  | { type: "tool_completed"; tool: string; ok: boolean }
  | { type: "turn_completed" }
  | { type: "completed" }
  | { type: "failed"; message: string };
