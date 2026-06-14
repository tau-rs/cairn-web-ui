import { describe, it, expect } from "vitest";
import { applyAgentEvent, emptyAssistantTurn } from "./askReducer";
import type { AgentEvent } from "../client/agent";

const reduce = (events: AgentEvent[]) =>
  events.reduce(applyAgentEvent, emptyAssistantTurn());

describe("applyAgentEvent", () => {
  it("accumulates text deltas in order", () => {
    const t = reduce([
      { type: "text_delta", text: "Hello " },
      { type: "text_delta", text: "world" },
    ]);
    expect(t.text).toBe("Hello world");
  });

  it("extracts distinct citations from embedded wikilinks", () => {
    const t = reduce([
      { type: "text_delta", text: "see [[store]] and " },
      { type: "text_delta", text: "[[timer]] and again [[store]]" },
    ]);
    expect(t.citations).toEqual(["store", "timer"]);
  });

  it("tracks tool start then completion", () => {
    const t = reduce([
      { type: "tool_started", tool: "search_notes" },
      { type: "tool_completed", tool: "search_notes", ok: true },
    ]);
    expect(t.tools).toEqual([{ tool: "search_notes", ok: true }]);
  });

  it("ignores unknown event kinds (non-exhaustive safety)", () => {
    const before = emptyAssistantTurn();
    const after = applyAgentEvent(before, { type: "mystery" } as unknown as AgentEvent);
    expect(after).toEqual(before);
  });

  it("does not mutate the input turn", () => {
    const before = emptyAssistantTurn();
    applyAgentEvent(before, { type: "text_delta", text: "x" });
    expect(before.text).toBe("");
  });
});
