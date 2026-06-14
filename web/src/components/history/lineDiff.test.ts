import { describe, it, expect } from "vitest";
import { lineDiff } from "./lineDiff";

describe("lineDiff", () => {
  it("returns all context lines when both sides are identical", () => {
    const rows = lineDiff("a\nb\nc", "a\nb\nc");
    expect(rows).toEqual([
      { type: "ctx", text: "a" },
      { type: "ctx", text: "b" },
      { type: "ctx", text: "c" },
    ]);
  });

  it("marks a purely added line", () => {
    const rows = lineDiff("a\nc", "a\nb\nc");
    expect(rows).toEqual([
      { type: "ctx", text: "a" },
      { type: "add", text: "b" },
      { type: "ctx", text: "c" },
    ]);
  });

  it("marks a purely deleted line", () => {
    const rows = lineDiff("a\nb\nc", "a\nc");
    expect(rows).toEqual([
      { type: "ctx", text: "a" },
      { type: "del", text: "b" },
      { type: "ctx", text: "c" },
    ]);
  });

  it("emits a deletion then an addition for a changed line", () => {
    const rows = lineDiff("a\nb\nc", "a\nB\nc");
    expect(rows).toEqual([
      { type: "ctx", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "ctx", text: "c" },
    ]);
  });

  it("preserves blank lines and whitespace", () => {
    const rows = lineDiff("a\n\n  b", "a\n\n  b");
    expect(rows).toEqual([
      { type: "ctx", text: "a" },
      { type: "ctx", text: "" },
      { type: "ctx", text: "  b" },
    ]);
  });

  it("treats an empty old side as all additions", () => {
    const rows = lineDiff("", "x\ny");
    expect(rows).toEqual([
      { type: "add", text: "x" },
      { type: "add", text: "y" },
    ]);
  });

  it("treats two empty strings as zero rows", () => {
    expect(lineDiff("", "")).toEqual([]);
  });
});
