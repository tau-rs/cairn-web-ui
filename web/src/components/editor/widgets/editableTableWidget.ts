import { WidgetType } from "@codemirror/view";
import {
  parseTable,
  serializeTable,
  addRow,
  removeRow,
  addColumn,
  removeColumn,
  type TableModel,
} from "../tableParse";

export class EditableTableWidget extends WidgetType {
  constructor(
    readonly md: string,
    readonly from: number,
    readonly to: number,
    readonly onCommit: (from: number, to: number, md: string) => void,
  ) {
    super();
  }
  /** True while a structural op re-renders the table in place. A re-render
   *  removes the focused cell, which fires a spurious `focusout`; this flag
   *  tells the commit handler to ignore that (structural ops are local-DOM
   *  only — no CodeMirror dispatch until focus truly leaves the table). */
  private applying = false;

  eq(other: EditableTableWidget): boolean {
    return (
      other.md === this.md && other.from === this.from && other.to === this.to
    );
  }
  ignoreEvent(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-lp-table-edit";
    const table = document.createElement("table");
    table.className = "cm-lp-table editing";
    wrap.appendChild(table);
    this.render(table, parseTable(this.md));

    // Commit once when focus leaves the whole table (click away / Esc).
    wrap.addEventListener("focusout", (e) => {
      if (this.applying) return; // re-render in progress, not a real blur
      const next = e.relatedTarget as Node | null;
      if (next && wrap.contains(next)) return; // moving between cells
      const md = serializeTable(this.readModel(table));
      const original = serializeTable(parseTable(this.md));
      if (md !== original) this.onCommit(this.from, this.to, md);
    });

    // Focus the first cell on enter.
    requestAnimationFrame(() => {
      wrap.querySelector<HTMLElement>("th, td")?.focus();
    });
    return wrap;
  }

  /** Read the current model back out of the live DOM. Reads ONLY each cell's
   *  direct text nodes, so control buttons added inside cells (Task 4) are
   *  excluded from the committed text. */
  protected readModel(table: HTMLTableElement): TableModel {
    const text = (cell: Element): string =>
      [...cell.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
    const header = [...table.querySelectorAll("thead th")].map(text);
    const rows = [...table.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map(text),
    );
    return { header, rows };
  }

  /** Build the table DOM from a model. Re-callable to re-render in place. */
  protected render(table: HTMLTableElement, model: TableModel): void {
    table.textContent = "";
    const thead = table.createTHead();
    const hr = thead.insertRow();
    model.header.forEach((h, ci) => {
      const th = document.createElement("th");
      th.contentEditable = "plaintext-only";
      th.textContent = h;
      th.appendChild(
        this.ctl("cm-lp-col-del", "×", () =>
          this.apply(table, removeColumn(this.readModel(table), ci)),
        ),
      );
      hr.appendChild(th);
    });
    const tbody = table.createTBody();
    model.rows.forEach((row, ri) => {
      const tr = tbody.insertRow();
      row.forEach((c, ci) => {
        const td = tr.insertCell();
        td.contentEditable = "plaintext-only";
        td.textContent = c;
        if (ci === 0) {
          td.appendChild(
            this.ctl("cm-lp-row-del", "×", () =>
              this.apply(table, removeRow(this.readModel(table), ri)),
            ),
          );
        }
      });
    });
    // edge "+" controls live on the wrapper, positioned via CSS
    const wrap = table.parentElement!;
    wrap
      .querySelectorAll(".cm-lp-add-col, .cm-lp-add-row")
      .forEach((n) => n.remove());
    wrap.appendChild(
      this.ctl("cm-lp-add-col", "+", () =>
        this.apply(table, addColumn(this.readModel(table))),
      ),
    );
    wrap.appendChild(
      this.ctl("cm-lp-add-row", "+", () =>
        this.apply(table, addRow(this.readModel(table))),
      ),
    );
  }

  /** A non-editable control button that doesn't steal the contenteditable caret. */
  private ctl(cls: string, label: string, onClick: () => void): HTMLElement {
    const b = document.createElement("button");
    b.className = cls;
    b.type = "button";
    b.textContent = label;
    b.contentEditable = "false";
    b.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep focus inside the table (no commit)
      onClick();
    });
    return b;
  }

  /** Apply a structural op: re-render in place, keep editing, refocus a cell.
   *  Re-rendering removes the focused cell (firing a spurious `focusout`), so
   *  guard the commit handler with `applying` until focus is restored. NO
   *  CodeMirror dispatch happens here — the single commit is on real focus-out. */
  private apply(table: HTMLTableElement, model: TableModel): void {
    this.applying = true;
    this.render(table, model);
    requestAnimationFrame(() => {
      table.querySelector<HTMLElement>("th, td")?.focus();
      this.applying = false;
    });
  }
}
