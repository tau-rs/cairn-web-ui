import { EditorView } from "@codemirror/view";
import { setTableFocus } from "./tableFocus";
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

/** Apply a structural op to the table block spanning [from, to] in the document.
 *  Dispatches a single replace, parks the cursor at the block start (keeping the
 *  table editable), and records which cell to refocus after the widget rebuilds. */
export function applyTableOp(
  view: EditorView,
  from: number,
  to: number,
  op: TableOp,
  focus: { row: number; col: number },
): void {
  const md = view.state.sliceDoc(from, to);
  // Compare against the prettified baseline (not the raw slice) so a structural
  // no-op — e.g. a guard-hit delete or move-to-same-index — does not dispatch a
  // reformat-only transaction. Relies on serializeTable being a stable fixed point.
  const base = serializeTable(parseTable(md));
  const next = computeTableEdit(md, op);
  if (next === base) return; // structural no-op → no transaction
  view.dispatch({
    changes: { from, to, insert: next },
    selection: { anchor: from },
    effects: setTableFocus.of({ pos: from, row: focus.row, col: focus.col }),
  });
}
