import { describe, it, expect } from "vitest";
import { extractLinks, stem } from "./wikilink";

describe("extractLinks", () => {
  it("extracts plain and aliased links in order with duplicates", () => {
    expect(extractLinks("see [[Alpha]] and [[Beta|the second]] then [[Alpha]]")).toEqual([
      "Alpha",
      "Beta",
      "Alpha",
    ]);
  });

  it("ignores unclosed and whitespace-only links", () => {
    expect(extractLinks("[[ ]] and [[unclosed")).toEqual([]);
  });
});

describe("stem", () => {
  it("strips directory and .md extension", () => {
    expect(stem("dir/sub/note.md")).toBe("note");
    expect(stem("b.md")).toBe("b");
    expect(stem("noext")).toBe("noext");
  });
});
