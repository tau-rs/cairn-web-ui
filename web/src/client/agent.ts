/** A streaming agent event. Mirrors the engine's port `AgentEvent`
 *  (`cairn_ports::AgentEvent`), which the Tauri transport serializes straight to
 *  the webview (the desktop app talks to the engine in-process, so it does not
 *  use the daemon's wire `AnswerEvent`). The port enum is `#[non_exhaustive]` —
 *  consumers MUST ignore unknown `type` values rather than crash. Citations are
 *  not a separate variant: the port emits no citation event, so the UI derives
 *  them from any `[[stem]]` wikilinks the agent writes into `text_delta` text. */
export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; tool: string }
  | { type: "tool_completed"; tool: string; ok: boolean }
  | { type: "turn_completed" }
  | { type: "completed" }
  | { type: "failed"; message: string };
