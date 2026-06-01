import { describe, it, expect, vi } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { DecorationSet } from "@codemirror/view";
import { buildLivePreviewDecorations } from "./livePreview";

const opts = {
  resolve: (t: string) => (t === "ideas" ? "ideas.md" : null),
  onOpenNote: vi.fn(),
  onToggleCheckbox: vi.fn(),
  resolveImage: (src: string) => "resolved:" + src,
};

interface Deco {
  from: number;
  to: number;
  class?: string;
  hidden: boolean;
  widget: boolean;
}

function decos(doc: string, cursor: number): Deco[] {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
    extensions: [markdown({ base: markdownLanguage })],
  });
  const set: DecorationSet = buildLivePreviewDecorations(state, opts);
  const out: Deco[] = [];
  set.between(0, doc.length, (from, to, value) => {
    const spec = value.spec as { class?: string; widget?: unknown };
    out.push({
      from,
      to,
      class: spec.class,
      widget: spec.widget != null,
      hidden: spec.class == null && spec.widget == null,
    });
  });
  return out;
}

describe("buildLivePreviewDecorations", () => {
  it("styles a heading and hides the # marker when the cursor is elsewhere", () => {
    const doc = "# Title\n\nbody";
    const ds = decos(doc, doc.indexOf("body"));
    expect(ds.some((d) => d.class === "cm-lp-h1")).toBe(true);
    expect(ds.some((d) => d.hidden && d.from === 0)).toBe(true);
  });
  it("reveals the # marker when the cursor is on the heading line", () => {
    const ds = decos("# Title\n\nbody", 3);
    expect(ds.some((d) => d.hidden && d.from === 0)).toBe(false);
  });
  it("hides ** markers around bold off-cursor", () => {
    const ds = decos("a **b** c", 0);
    expect(ds.some((d) => d.class === "cm-lp-strong")).toBe(true);
    expect(ds.filter((d) => d.hidden).length).toBeGreaterThanOrEqual(2);
  });
  it("renders a resolved [[wikilink]] as a widget off-cursor", () => {
    const ds = decos("see [[ideas]] end", 0);
    expect(ds.some((d) => d.widget)).toBe(true);
  });
  it("reveals raw [[wikilink]] when the cursor is inside it", () => {
    const ds = decos("see [[ideas]] end", 7);
    expect(ds.some((d) => d.widget)).toBe(false);
  });
  it("marks bullet list lines and replaces the bullet marker off-cursor", () => {
    const doc = "- alpha\n- beta";
    const ds = decos(doc, doc.length); // cursor on 2nd line end
    // first line's marker (positions 0..1 = "- ") is replaced by a bullet widget
    expect(ds.some((d) => d.widget && d.from === 0)).toBe(true);
    // a list-item line class is applied
    expect(ds.some((d) => d.class === "cm-lp-li")).toBe(true);
  });
  it("reveals the raw bullet marker when the cursor is on that item", () => {
    const ds = decos("- alpha\n- beta", 2); // cursor inside first item
    expect(ds.some((d) => d.widget && d.from === 0)).toBe(false);
  });
  it("keeps the number marker on ordered lists (no bullet widget)", () => {
    const doc = "1. one\n2. two";
    const ds = decos(doc, doc.length);
    // ordered markers are not replaced with a bullet widget
    expect(ds.some((d) => d.widget && d.from === 0)).toBe(false);
    expect(ds.some((d) => d.class === "cm-lp-li")).toBe(true);
  });
  it("styles a blockquote line and hides the > marker off-cursor", () => {
    const doc = "> quoted\n\nbody";
    const ds = decos(doc, doc.indexOf("body"));
    expect(ds.some((d) => d.class === "cm-lp-quote")).toBe(true);
    expect(ds.some((d) => d.hidden && d.from === 0)).toBe(true);
  });
  it("reveals the > marker when the cursor is in the quote", () => {
    const ds = decos("> quoted\n\nbody", 2);
    expect(ds.some((d) => d.hidden && d.from === 0)).toBe(false);
  });
  it("replaces a horizontal rule with a widget off-cursor", () => {
    const doc = "a\n\n---\n\nb";
    const hrPos = doc.indexOf("---");
    const ds = decos(doc, 0);
    expect(ds.some((d) => d.widget && d.from === hrPos)).toBe(true);
  });
  it("reveals the raw rule when the cursor is on it", () => {
    const doc = "a\n\n---\n\nb";
    const hrPos = doc.indexOf("---");
    const ds = decos(doc, hrPos + 1);
    expect(ds.some((d) => d.widget && d.from === hrPos)).toBe(false);
  });
  it("styles fenced-code lines and hides the fence lines off-cursor", () => {
    const doc = "text\n\n```js\nconst x = 1;\n```\n\nmore";
    const fence = doc.indexOf("```");
    const ds = decos(doc, 0);
    expect(ds.some((d) => d.class === "cm-lp-codeblock")).toBe(true);
    // opening fence line is hidden
    expect(ds.some((d) => d.hidden && d.from === fence)).toBe(true);
    const closingFence = doc.lastIndexOf("```");
    expect(ds.some((d) => d.hidden && d.from === closingFence)).toBe(true);
  });
  it("reveals the fences when the cursor is inside the code block", () => {
    const doc = "text\n\n```js\nconst x = 1;\n```\n\nmore";
    const fence = doc.indexOf("```");
    const ds = decos(doc, doc.indexOf("const"));
    expect(ds.some((d) => d.hidden && d.from === fence)).toBe(false);
    const closingFence = doc.lastIndexOf("```");
    expect(ds.some((d) => d.hidden && d.from === closingFence)).toBe(false);
  });
  it("renders a task checkbox as a widget off-cursor", () => {
    const doc = "- [ ] todo item";
    const ds = decos(doc, doc.length); // cursor at end, off the marker
    const open = doc.indexOf("[");
    expect(ds.some((d) => d.widget && d.from === open)).toBe(true);
  });
  it("reveals the raw [ ] marker when the cursor is on the task", () => {
    const doc = "- [ ] todo item";
    const open = doc.indexOf("[");
    const ds = decos(doc, open + 1);
    expect(ds.some((d) => d.widget && d.from === open)).toBe(false);
  });
  it("hides the list bullet for a task item (checkbox only, no bullet)", () => {
    const doc = "- [ ] todo item";
    const ds = decos(doc, doc.length); // off the marker
    // the "- " marker is hidden (a plain replace, not a widget) at the line start
    expect(ds.some((d) => d.from === 0 && d.hidden)).toBe(true);
    expect(ds.some((d) => d.from === 0 && d.widget)).toBe(false);
    // the checkbox widget renders at the "[" position
    const open = doc.indexOf("[");
    expect(ds.some((d) => d.widget && d.from === open)).toBe(true);
  });
  it("replaces an image with a widget off-cursor", () => {
    const doc = "see ![logo](img/logo.png) here";
    const at = doc.indexOf("![");
    const ds = decos(doc, 0);
    expect(ds.some((d) => d.widget && d.from === at)).toBe(true);
  });
  it("reveals the raw image markdown when the cursor is on it", () => {
    const doc = "see ![logo](img/logo.png) here";
    const at = doc.indexOf("![");
    const ds = decos(doc, at + 2);
    expect(ds.some((d) => d.widget && d.from === at)).toBe(false);
  });
});
