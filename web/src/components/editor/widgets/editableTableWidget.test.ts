import { describe, it, expect, afterEach, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { EditableTableWidget } from "./editableTableWidget";
import { tableFocus } from "../tableFocus";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Mount the widget inside a real EditorView so toDOM(view) has a live view. */
function mount(doc: string) {
  const widget = new EditableTableWidget(doc, 0, doc.length, () => {});
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [tableFocus] }),
  });
  const dom = widget.toDOM(view);
  const container = document.createElement("div"); // stands in for cm contentDOM
  container.appendChild(dom);
  document.body.appendChild(container);
  return { widget, view, dom, container };
}

describe("EditableTableWidget cell key handling", () => {
  function pressOn(doc: string) {
    const { container, dom, view } = mount(doc);
    const cell = dom.querySelector<HTMLElement>("tbody td")!;
    let reachedEditor = false;
    container.addEventListener("keydown", () => {
      reachedEditor = true;
    });
    const press = (init: KeyboardEventInit) =>
      cell.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
      );
    return { press, reachedEditor: () => reachedEditor, view };
  }
  const md = "| A | B |\n| - | - |\n| 1 | 2 |";

  it("keeps Ctrl+A scoped to the cell (does not reach CodeMirror's selectAll)", () => {
    const { press, reachedEditor, view } = pressOn(md);
    press({ key: "a", ctrlKey: true });
    expect(reachedEditor()).toBe(false);
    view.destroy();
  });
  it("keeps Cmd+A scoped to the cell", () => {
    const { press, reachedEditor, view } = pressOn(md);
    press({ key: "a", metaKey: true });
    expect(reachedEditor()).toBe(false);
    view.destroy();
  });
  it("lets ordinary typing propagate", () => {
    const { press, reachedEditor, view } = pressOn(md);
    press({ key: "a" });
    expect(reachedEditor()).toBe(true);
    view.destroy();
  });
});

describe("EditableTableWidget structure controls", () => {
  it("renders a grip for each row and column", () => {
    const { dom, view } = mount("| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |");
    expect(dom.querySelectorAll(".cm-lp-col-grip").length).toBe(2);
    expect(dom.querySelectorAll(".cm-lp-row-grip").length).toBe(2);
    view.destroy();
  });

  it("opens a menu with Delete column when a column grip is clicked", () => {
    const { dom, view } = mount("| A | B |\n| - | - |\n| 1 | 2 |");
    dom
      .querySelector<HTMLElement>(".cm-lp-col-grip")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const labels = [...document.querySelectorAll("[role=menuitem]")].map(
      (n) => n.textContent,
    );
    expect(labels).toContain("Delete column");
    view.destroy();
  });

  it("inserting a row below via the row grip menu updates the document", () => {
    const { dom, view } = mount("| A | B |\n| - | - |\n| 1 | 2 |");
    dom
      .querySelector<HTMLElement>(".cm-lp-row-grip")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
      (n) => n.textContent === "Insert row below",
    )!;
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // header + delimiter + original row + new blank row = 4 lines
    expect(view.state.doc.toString().split("\n").length).toBe(4);
    view.destroy();
  });
});

describe("EditableTableWidget commit safety during structural ops", () => {
  it("captures uncommitted cell text into the op and suppresses the stale commit", () => {
    const onCommit = vi.fn();
    const md = "| A | B |\n| - | - |\n| 1 | 2 |";
    const widget = new EditableTableWidget(md, 0, md.length, onCommit);
    const view = new EditorView({
      state: EditorState.create({ doc: md, extensions: [tableFocus] }),
    });
    const dom = widget.toDOM(view);
    document.body.appendChild(dom);

    // simulate uncommitted typing in the first body cell
    dom.querySelector<HTMLElement>("tbody td")!.textContent = "EDITED";

    // open the first row grip menu and click "Insert row below"
    dom
      .querySelector<HTMLElement>(".cm-lp-row-grip")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    [...document.querySelectorAll<HTMLElement>("[role=menuitem]")]
      .find((n) => n.textContent === "Insert row below")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // simulate the blur that fires when the dispatch tears down the old DOM
    dom.dispatchEvent(
      new FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: document.body as unknown as EventTarget,
      }),
    );

    const out = view.state.doc.toString();
    expect(out).toContain("EDITED"); // typed text preserved by the op
    expect(out.split("\n").length).toBe(4); // header + delim + edited row + new row
    expect(onCommit).not.toHaveBeenCalled(); // no stale clobbering commit
    view.destroy();
  });
});
