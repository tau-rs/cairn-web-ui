import { describe, it, expect, vi } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { DecorationSet } from "@codemirror/view";
import { buildLivePreviewDecorations } from "./livePreview";

const opts = {
  resolve: (t: string) => (t === "ideas" ? "ideas.md" : null),
  onOpenNote: vi.fn(),
};

interface Deco { from: number; to: number; class?: string; hidden: boolean; widget: boolean }

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
    out.push({ from, to, class: spec.class, widget: spec.widget != null, hidden: spec.class == null && spec.widget == null });
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
});
