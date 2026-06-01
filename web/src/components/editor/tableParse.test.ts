import { describe, it, expect } from "vitest";
import { parseTable } from "./tableParse";

describe("parseTable", () => {
  it("parses header and body rows, dropping the delimiter row", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    expect(parseTable(md)).toEqual({
      header: ["A", "B"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
  });
  it("tolerates missing outer pipes", () => {
    const md = "A | B\n--- | ---\n1 | 2";
    expect(parseTable(md)).toEqual({ header: ["A", "B"], rows: [["1", "2"]] });
  });
});
