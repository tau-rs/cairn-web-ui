import { WidgetType } from "@codemirror/view";
import { parseTable, serializeTable, type TableModel } from "../tableParse";

export class EditableTableWidget extends WidgetType {
  constructor(
    readonly md: string,
    readonly from: number,
    readonly to: number,
    readonly onCommit: (from: number, to: number, md: string) => void,
  ) {
    super();
  }
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
    for (const h of model.header) {
      const th = document.createElement("th");
      th.contentEditable = "plaintext-only";
      th.textContent = h;
      hr.appendChild(th);
    }
    const tbody = table.createTBody();
    for (const row of model.rows) {
      const tr = tbody.insertRow();
      for (const c of row) {
        const td = tr.insertCell();
        td.contentEditable = "plaintext-only";
        td.textContent = c;
      }
    }
  }
}
