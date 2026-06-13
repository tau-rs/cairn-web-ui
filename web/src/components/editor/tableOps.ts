import {
  parseTable,
  serializeTable,
  insertRow,
  removeRow,
  moveRow,
  insertColumn,
  removeColumn,
  moveColumn,
  pasteBlock,
  addColumn,
  addRow,
  TableModel,
} from "./tableParse";

export type TableOp =
  | { kind: "insertRow"; index: number }
  | { kind: "removeRow"; index: number }
  | { kind: "moveRow"; from: number; to: number }
  | { kind: "insertColumn"; index: number }
  | { kind: "removeColumn"; index: number }
  | { kind: "moveColumn"; from: number; to: number }
  | { kind: "paste"; atRow: number; atCol: number; block: string[][] };

/** PURE: apply a structural op to a table's markdown source, returning new source. */
export function computeTableEdit(md: string, op: TableOp): string {
  const m = parseTable(md);
  switch (op.kind) {
    case "insertRow":
      return serializeTable(insertRow(m, op.index));
    case "removeRow":
      return serializeTable(removeRow(m, op.index));
    case "moveRow":
      return serializeTable(moveRow(m, op.from, op.to));
    case "insertColumn":
      return serializeTable(insertColumn(m, op.index));
    case "removeColumn":
      return serializeTable(removeColumn(m, op.index));
    case "moveColumn":
      return serializeTable(moveColumn(m, op.from, op.to));
    case "paste":
      return serializeTable(pasteBlockFull(m, op.atRow, op.atCol, op.block));
  }
}

/**
 * Paste a 2-D block in "full-table" coordinates where row 0 is the header
 * row and rows 1+ are body rows.  Delegates to pasteBlock for the body-only
 * portion after writing any header cells directly.
 */
function pasteBlockFull(
  m: TableModel,
  atRow: number,
  atCol: number,
  block: string[][],
): TableModel {
  if (block.length === 0) return m;
  const blockCols = Math.max(...block.map((r) => r.length));
  // Grow columns first so header write below sees the right width.
  let model = m;
  while (model.header.length < atCol + blockCols) model = addColumn(model);

  let result = model;
  // Rows where atRow === 0: first block row goes into the header.
  if (atRow === 0) {
    const headerRow = block[0];
    const header = [...result.header];
    headerRow.forEach((val, ci) => {
      const C = atCol + ci;
      if (C >= 0 && C < header.length) header[C] = val;
    });
    result = { ...result, header };
    // Remaining block rows paste into body starting at row 0.
    const bodyBlock = block.slice(1);
    if (bodyBlock.length > 0) {
      while (result.rows.length < bodyBlock.length) result = addRow(result);
      result = pasteBlock(result, 0, atCol, bodyBlock);
    }
  } else {
    result = pasteBlock(result, atRow - 1, atCol, block);
  }
  return result;
}
