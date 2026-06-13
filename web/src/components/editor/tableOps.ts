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
} from "./tableParse";

export type TableOp =
  | { kind: "insertRow"; index: number }
  | { kind: "removeRow"; index: number }
  | { kind: "moveRow"; from: number; to: number }
  | { kind: "insertColumn"; index: number }
  | { kind: "removeColumn"; index: number }
  | { kind: "moveColumn"; from: number; to: number }
  | { kind: "paste"; atRow: number; atCol: number; block: string[][] };

/** PURE: apply a structural op to a table's markdown source, returning new source.
 *  For "paste", (atRow, atCol) are BODY coordinates (atRow 0 = first body row). */
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
      return serializeTable(pasteBlock(m, op.atRow, op.atCol, op.block));
  }
}
