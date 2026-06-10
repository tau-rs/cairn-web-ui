import { describe, it, expect } from "vitest";
import { EditableTableWidget } from "./editableTableWidget";

/** Build the widget DOM inside a container that stands in for CodeMirror's
 *  contentDOM. A keydown that reaches the container is one CodeMirror's keymap
 *  would have handled (e.g. Mod-a → whole-document selectAll). */
function mountWidget() {
  const md = "| A | B |\n| - | - |\n| 1 | 2 |";
  const widget = new EditableTableWidget(md, 0, md.length, () => {});
  const container = document.createElement("div"); // stands in for cm contentDOM
  container.appendChild(widget.toDOM());
  document.body.appendChild(container);
  const cell = container.querySelector<HTMLElement>("tbody td")!;
  let reachedEditor = false;
  container.addEventListener("keydown", () => {
    reachedEditor = true;
  });
  const press = (init: KeyboardEventInit) =>
    cell.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
    );
  return { cell, press, reachedEditor: () => reachedEditor };
}

describe("EditableTableWidget cell key handling", () => {
  it("keeps Ctrl+A scoped to the cell (does not reach CodeMirror's selectAll)", () => {
    const { press, reachedEditor } = mountWidget();
    press({ key: "a", ctrlKey: true });
    expect(reachedEditor()).toBe(false);
  });

  it("keeps Cmd+A scoped to the cell (does not reach CodeMirror's selectAll)", () => {
    const { press, reachedEditor } = mountWidget();
    press({ key: "a", metaKey: true });
    expect(reachedEditor()).toBe(false);
  });

  it("lets ordinary typing propagate (only select-all is intercepted)", () => {
    const { press, reachedEditor } = mountWidget();
    press({ key: "a" });
    expect(reachedEditor()).toBe(true);
  });
});
