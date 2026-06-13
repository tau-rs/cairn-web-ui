import { describe, it, expect } from "vitest";
import {
  parseTable,
  serializeTable,
  addRow,
  removeRow,
  addColumn,
  removeColumn,
} from "./tableParse";

describe("parseTable", () => {
  it("parses header, body, and per-column alignment", () => {
    const md = "| A | B | C | D |\n|---|:--|:-:|--:|\n| 1 | 2 | 3 | 4 |";
    expect(parseTable(md)).toEqual({
      header: ["A", "B", "C", "D"],
      rows: [["1", "2", "3", "4"]],
      align: ["none", "left", "center", "right"],
    });
  });
  it("tolerates missing outer pipes and defaults alignment to none", () => {
    const md = "A | B\n--- | ---\n1 | 2";
    expect(parseTable(md)).toEqual({
      header: ["A", "B"],
      rows: [["1", "2"]],
      align: ["none", "none"],
    });
  });
  it("pads a short alignment row to header length", () => {
    const md = "| A | B |\n| :-: |\n| 1 | 2 |";
    expect(parseTable(md).align).toEqual(["center", "none"]);
  });
  it("returns empty model for empty input", () => {
    expect(parseTable("")).toEqual({ header: [], rows: [], align: [] });
  });
});

describe("serializeTable", () => {
  it("emits GFM with a left-aligned delimiter row", () => {
    expect(serializeTable({ header: ["A", "B"], rows: [["1", "2"]] })).toBe(
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
    );
  });
  it("round-trips through parseTable", () => {
    const model = {
      header: ["A", "B"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
    };
    expect(parseTable(serializeTable(model))).toEqual(model);
  });
  it("escapes pipes in cell text and parse unescapes them", () => {
    const model = { header: ["A"], rows: [["x|y"]] };
    const md = serializeTable(model);
    expect(md).toContain("x\\|y");
    expect(parseTable(md)).toEqual(model);
  });
  it("round-trips a cell containing a backslash", () => {
    const model = { header: ["A\\B"], rows: [["x\\"]] };
    expect(parseTable(serializeTable(model))).toEqual(model);
  });
});

describe("table model ops", () => {
  const m = { header: ["A", "B"], rows: [["1", "2"]] };
  it("addRow appends a blank row", () => {
    expect(addRow(m)).toEqual({
      header: ["A", "B"],
      rows: [
        ["1", "2"],
        ["", ""],
      ],
    });
  });
  it("removeRow deletes a row but keeps at least one", () => {
    expect(removeRow(m, 0)).toEqual(m); // only one row → no-op
    const m2 = { header: ["A"], rows: [["1"], ["2"]] };
    expect(removeRow(m2, 0)).toEqual({ header: ["A"], rows: [["2"]] });
  });
  it("addColumn appends a blank column to header and every row", () => {
    expect(addColumn(m)).toEqual({
      header: ["A", "B", ""],
      rows: [["1", "2", ""]],
    });
  });
  it("removeColumn deletes a column but keeps at least one", () => {
    expect(removeColumn(m, 1)).toEqual({ header: ["A"], rows: [["1"]] });
    const oneCol = { header: ["A"], rows: [["1"]] };
    expect(removeColumn(oneCol, 0)).toEqual(oneCol); // no-op at minimum
  });
});
