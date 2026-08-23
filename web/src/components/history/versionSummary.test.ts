import { describe, it, expect } from "vitest";
import { versionWordDelta } from "./versionSummary";

const base = { id: "c1", author: "a", timestamp_secs: 1 };

describe("versionWordDelta", () => {
  it("prefers structured C0 fields", () => {
    expect(
      versionWordDelta({
        ...base,
        message: "x",
        words_added: 124,
        words_removed: 3,
      }),
    ).toEqual({ added: 124, removed: 3 });
  });

  it("falls back to parsing the deterministic message", () => {
    expect(
      versionWordDelta({
        ...base,
        message: 'Edit "Q3 Roadmap" § Goals (+42/−3 words)',
      }),
    ).toEqual({ added: 42, removed: 3 });
    expect(
      versionWordDelta({ ...base, message: 'Edit "x" (+1/-2 words)' }),
    ).toEqual({ added: 1, removed: 2 });
  });

  it("returns null when nothing is derivable", () => {
    expect(
      versionWordDelta({ ...base, message: "cairn: update note.md" }),
    ).toBeNull();
  });
});
