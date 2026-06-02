export interface ParsedTable {
  header: string[];
  rows: string[][];
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

/** Parse a GFM pipe table's source into a header + body rows. Assumes line 2 is
 *  the `---|---` delimiter row and drops it. */
export function parseTable(md: string): ParsedTable {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  return { header, rows };
}
