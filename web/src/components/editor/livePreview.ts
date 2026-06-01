import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { type EditorState, type Range } from "@codemirror/state";
import { WikilinkWidget } from "./wikilinkWidget";
import { BulletWidget } from "./widgets/bulletWidget";
import { HrWidget } from "./widgets/hrWidget";

export interface LivePreviewOptions {
  resolve: (target: string) => string | null;
  onOpenNote: (path: string) => void;
}

const HEADING_CLASS: Record<string, string> = {
  ATXHeading1: "cm-lp-h1",
  ATXHeading2: "cm-lp-h2",
  ATXHeading3: "cm-lp-h3",
  ATXHeading4: "cm-lp-h4",
  ATXHeading5: "cm-lp-h5",
  ATXHeading6: "cm-lp-h6",
};
const INLINE_CLASS: Record<string, string> = {
  StrongEmphasis: "cm-lp-strong",
  Emphasis: "cm-lp-em",
  Strikethrough: "cm-lp-strike",
  InlineCode: "cm-lp-code",
};
const MARK_CHILD: Record<string, string> = {
  StrongEmphasis: "EmphasisMark",
  Emphasis: "EmphasisMark",
  Strikethrough: "StrikethroughMark",
  InlineCode: "CodeMark",
};

const WIKILINK = /\[\[([^\]]+?)\]\]/g;

function selectionTouches(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
}

export function lineRange(state: EditorState, from: number, to: number) {
  return { start: state.doc.lineAt(from).from, end: state.doc.lineAt(to).to };
}

function isInsideCode(state: EditorState, pos: number): boolean {
  const node = syntaxTree(state).resolveInner(pos, 1);
  for (let n: typeof node | null = node; n; n = n.parent) {
    if (/Code/.test(n.name)) return true;
  }
  return false;
}

/** PURE: build the live-preview decoration set for a given editor state. */
export function buildLivePreviewDecorations(
  state: EditorState,
  opts: LivePreviewOptions,
): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter: (node) => {
      const { name, from, to } = node;
      if (HEADING_CLASS[name]) {
        decos.push(
          Decoration.mark({ class: HEADING_CLASS[name] }).range(from, to),
        );
        if (!selectionTouches(state, from, to)) {
          const mark = node.node.getChild("HeaderMark");
          if (mark) {
            // hide the #'s and the following space
            const end = Math.min(mark.to + 1, to);
            decos.push(Decoration.replace({}).range(mark.from, end));
          }
        }
      } else if (INLINE_CLASS[name]) {
        decos.push(
          Decoration.mark({ class: INLINE_CLASS[name] }).range(from, to),
        );
        if (!selectionTouches(state, from, to)) {
          for (const m of node.node.getChildren(MARK_CHILD[name])) {
            decos.push(Decoration.replace({}).range(m.from, m.to));
          }
        }
      } else if (name === "Link") {
        // A `[[wikilink]]` parses its inner `[wikilink]` as a Link node; skip it
        // so the wikilink widget (below) owns that range — otherwise we'd emit a
        // stray cm-lp-link class and overlapping replace decorations.
        if (state.doc.sliceString(from - 1, from) === "[") return;
        decos.push(Decoration.mark({ class: "cm-lp-link" }).range(from, to));
        if (!selectionTouches(state, from, to)) {
          // hide the leading `[` and the trailing `](url)`, keep the link text
          const openBracket = node.node.getChild("LinkMark"); // first [
          if (openBracket)
            decos.push(
              Decoration.replace({}).range(openBracket.from, openBracket.to),
            );
          const closeStart = findCloseBracket(
            state,
            openBracket ? openBracket.to : from,
            to,
          );
          if (closeStart != null)
            decos.push(Decoration.replace({}).range(closeStart, to));
        }
      } else if (name === "ListItem") {
        // Style each line of the item; replace a bullet marker with a • widget.
        const firstLine = state.doc.lineAt(from);
        const touched = selectionTouches(state, firstLine.from, firstLine.to);
        // indent every line of the item (continuation lines included)
        for (let pos = from; pos <= to; pos = state.doc.lineAt(pos).to + 1) {
          const ln = state.doc.lineAt(pos);
          decos.push(Decoration.line({ class: "cm-lp-li" }).range(ln.from));
          if (ln.to >= to) break;
        }
        const mark = node.node.getChild("ListMark");
        if (mark) {
          const markText = state.doc.sliceString(mark.from, mark.to);
          const isBullet = /^[-*+]$/.test(markText);
          if (isBullet && !touched) {
            // replace "- " (marker + following space) with the bullet widget
            const end = Math.min(mark.to + 1, firstLine.to);
            decos.push(
              Decoration.replace({ widget: new BulletWidget() }).range(
                mark.from,
                end,
              ),
            );
          }
        }
      } else if (name === "Blockquote") {
        // Class every line of the quote; hide each line's "> " mark off-cursor.
        const touched = selectionTouches(state, from, to);
        let pos = from;
        while (pos <= to) {
          const line = state.doc.lineAt(pos);
          decos.push(
            Decoration.line({ class: "cm-lp-quote" }).range(line.from),
          );
          if (!touched) {
            const match = /^(\s*>\s?)/.exec(line.text);
            if (match) {
              decos.push(
                Decoration.replace({}).range(
                  line.from,
                  line.from + match[1].length,
                ),
              );
            }
          }
          if (line.to >= to) break;
          pos = line.to + 1;
        }
      } else if (name === "HorizontalRule") {
        if (!selectionTouches(state, from, to)) {
          decos.push(
            Decoration.replace({ widget: new HrWidget() }).range(from, to),
          );
        }
      } else if (name === "FencedCode") {
        const lr = lineRange(state, from, to);
        const touched = selectionTouches(state, lr.start, lr.end);
        const firstLine = state.doc.lineAt(from).number;
        const lastLine = state.doc.lineAt(to).number;
        for (let n = firstLine; n <= lastLine; n++) {
          const line = state.doc.line(n);
          decos.push(
            Decoration.line({ class: "cm-lp-codeblock" }).range(line.from),
          );
          const isFence = /^\s*```/.test(line.text);
          if (isFence && !touched && line.length > 0) {
            decos.push(Decoration.replace({}).range(line.from, line.to));
          }
        }
      }
    },
  });

  // Wikilinks: the markdown parser ignores [[...]], so scan the text.
  const text = state.doc.toString();
  WIKILINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    if (isInsideCode(state, from)) continue;
    const inner = m[1];
    const target = inner.split("|")[0].trim();
    if (!target) continue;
    if (selectionTouches(state, from, to)) continue; // reveal raw
    const alias = inner.includes("|")
      ? inner.slice(inner.indexOf("|") + 1).trim()
      : target;
    const path = opts.resolve(target);
    decos.push(
      Decoration.replace({
        widget: new WikilinkWidget(alias, path, opts.onOpenNote),
      }).range(from, to),
    );
  }

  return Decoration.set(decos, /* sort */ true);
}

/** Find the closing `]` position of a link, between `searchFrom` and `to`. */
function findCloseBracket(
  state: EditorState,
  searchFrom: number,
  to: number,
): number | null {
  const slice = state.doc.sliceString(searchFrom, to);
  const idx = slice.indexOf("]");
  return idx === -1 ? null : searchFrom + idx;
}

/** The live-preview CodeMirror extension. */
export function livePreview(opts: LivePreviewOptions) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildLivePreviewDecorations(view.state, opts);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          this.decorations = buildLivePreviewDecorations(u.state, opts);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of(
          (view) => view.plugin(plugin)?.decorations ?? Decoration.none,
        ),
    },
  );
}
