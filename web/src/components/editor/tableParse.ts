export interface TableModel {
  header: string[];
  rows: string[][];
}

// Split a table row on UNescaped pipes, drop outer pipes, unescape \| → |.
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

/** Parse a GFM pipe table's source into a header + body rows (line 2 = delimiter, dropped). */
export function parseTable(md: string): TableModel {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  return { header, rows };
}

const escapeCell = (s: string): string => s.trim().replace(/\|/g, "\\|");
const fmtRow = (cs: string[]): string =>
  `| ${cs.map(escapeCell).join(" | ")} |`;

/** Serialize a model to GFM markdown (alignment normalized to left). */
export function serializeTable(m: TableModel): string {
  const delim = `| ${m.header.map(() => "---").join(" | ")} |`;
  return [fmtRow(m.header), delim, ...m.rows.map(fmtRow)].join("\n");
}

/** Append a blank row (column count = header length). */
export function addRow(m: TableModel): TableModel {
  return { header: m.header, rows: [...m.rows, m.header.map(() => "")] };
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
