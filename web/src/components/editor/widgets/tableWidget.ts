import { WidgetType } from "@codemirror/view";
import { parseTable } from "../tableParse";

export class TableWidget extends WidgetType {
  constructor(
    readonly md: string,
    readonly from: number,
    readonly onEnterEdit: (from: number) => void,
  ) {
    super();
  }
  eq(other: TableWidget): boolean {
    return other.md === this.md && other.from === this.from;
  }
  toDOM(): HTMLElement {
    const { header, rows } = parseTable(this.md);
    const table = document.createElement("table");
    table.className = "cm-lp-table";
    const thead = table.createTHead();
    const hr = thead.insertRow();
    for (const h of header) {
      const th = document.createElement("th");
      th.textContent = h;
      hr.appendChild(th);
    }
    const tbody = table.createTBody();
    for (const r of rows) {
      const tr = tbody.insertRow();
      for (const c of r) {
        tr.insertCell().textContent = c;
      }
    }
    table.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.onEnterEdit(this.from);
    });
    return table;
  }
  ignoreEvent(): boolean {
    return false;
  }
}
