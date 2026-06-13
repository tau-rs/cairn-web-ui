export type Align = "none" | "left" | "center" | "right";

export interface TableModel {
  header: string[];
  rows: string[][];
  align: Align[];
}

// Split a table row on UNescaped pipes, drop outer pipes, unescape \| → | then \\ → \.
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|").replace(/\\\\/g, "\\"));

/** Read one delimiter cell (e.g. `:--`, `:-:`, `--:`, `---`) into an Align. */
function parseAlign(cell: string): Align {
  const t = cell.trim();
  const left = t.startsWith(":");
  const right = t.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
}

/** Parse a GFM pipe table's source into header + body rows + per-column alignment
 *  (read from line 2, the delimiter row). */
export function parseTable(md: string): TableModel {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [], align: [] };
  const header = cells(lines[0]);
  const rawAlign = lines.length > 1 ? cells(lines[1]).map(parseAlign) : [];
  const align: Align[] = header.map((_, i) => rawAlign[i] ?? "none");
  const rows = lines.slice(2).map(cells);
  return { header, rows, align };
}

const escapeCell = (s: string): string =>
  s.trim().replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

/** A padded delimiter cell of width `w` for the given alignment. */
function marker(a: Align, w: number): string {
  if (a === "left") return ":" + "-".repeat(w - 1);
  if (a === "right") return "-".repeat(w - 1) + ":";
  if (a === "center") return ":" + "-".repeat(Math.max(1, w - 2)) + ":";
  return "-".repeat(w);
}

/** Serialize a model to prettified GFM: columns padded to equal width, alignment
 *  markers preserved. Minimum column width is 3 so every marker form fits. */
export function serializeTable(m: TableModel): string {
  const cols = m.header.length;
  const escHeader = m.header.map(escapeCell);
  const escRows = m.rows.map((r) =>
    Array.from({ length: cols }, (_, c) => escapeCell(r[c] ?? "")),
  );
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(3, escHeader[c].length, ...escRows.map((r) => r[c].length)),
  );
  const fmtRow = (cs: string[]): string =>
    `| ${cs.map((s, c) => s.padEnd(widths[c])).join(" | ")} |`;
  const delim = `| ${widths
    .map((w, c) => marker(m.align[c] ?? "none", w))
    .join(" | ")} |`;
  return [fmtRow(escHeader), delim, ...escRows.map(fmtRow)].join("\n");
}

/** Append a blank row (column count = header length). */
export function addRow(m: TableModel): TableModel {
  return { header: [...m.header], rows: [...m.rows, m.header.map(() => "")] };
}

/** Remove a body row; keeps at least one body row. */
export function removeRow(m: TableModel, index: number): TableModel {
  if (m.rows.length <= 1) return m;
  return { header: m.header, rows: m.rows.filter((_, i) => i !== index) };
}

/** Append a blank column to the header and every row. */
export function addColumn(m: TableModel): TableModel {
  return {
    header: [...m.header, ""],
    rows: m.rows.map((r) => [...r, ""]),
  };
}

/** Remove a column; keeps at least one column. */
export function removeColumn(m: TableModel, index: number): TableModel {
  if (m.header.length <= 1) return m;
  return {
    header: m.header.filter((_, i) => i !== index),
    rows: m.rows.map((r) => r.filter((_, i) => i !== index)),
  };
}
