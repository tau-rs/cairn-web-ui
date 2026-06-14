import { describe, it, expect } from "vitest";
import { lineDiff } from "./lineDiff";

describe("lineDiff", () => {
  it("returns all context rows for identical text", () => {
    const rows = lineDiff("a\nb\nc", "a\nb\nc");
    expect(rows.map((r) => r.type)).toEqual(["ctx", "ctx", "ctx"]);
    expect(rows.map((r) => r.text)).toEqual(["a", "b", "c"]);
    expect(rows[0]).toMatchObject({ oldLine: 1, newLine: 1 });
  });

  it("returns all adds when old is empty", () => {
    const rows = lineDiff("", "x\ny");
    expect(rows).toEqual([
      { type: "add", text: "x", oldLine: null, newLine: 1 },
      { type: "add", text: "y", oldLine: null, newLine: 2 },
    ]);
  });

  it("returns all dels when new is empty", () => {
    const rows = lineDiff("x\ny", "");
    expect(rows).toEqual([
      { type: "del", text: "x", oldLine: 1, newLine: null },
      { type: "del", text: "y", oldLine: 2, newLine: null },
    ]);
  });

  it("returns [] when both are empty", () => {
    expect(lineDiff("", "")).toEqual([]);
  });

  it("detects a mid-document insertion", () => {
    const rows = lineDiff("a\nc", "a\nb\nc");
    expect(rows).toEqual([
      { type: "ctx", text: "a", oldLine: 1, newLine: 1 },
      { type: "add", text: "b", oldLine: null, newLine: 2 },
      { type: "ctx", text: "c", oldLine: 2, newLine: 3 },
    ]);
  });

  it("detects a deletion", () => {
    const rows = lineDiff("a\nb\nc", "a\nc");
    expect(rows).toEqual([
      { type: "ctx", text: "a", oldLine: 1, newLine: 1 },
      { type: "del", text: "b", oldLine: 2, newLine: null },
      { type: "ctx", text: "c", oldLine: 3, newLine: 2 },
    ]);
  });

  it("treats matching trailing newlines as context, not a spurious diff", () => {
    const rows = lineDiff("a\nb\n", "a\nb\n");
    expect(rows.every((r) => r.type === "ctx")).toBe(true);
  });
});
