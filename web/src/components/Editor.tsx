import { useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { livePreview } from "./editor/livePreview";
import { toggleCheckboxChange } from "./editor/checkboxToggle";
import { makeImageResolver } from "./editor/imageResolver";
import {
  docTheme,
  docHighlightStyle,
  markdownCodeLanguages,
} from "./editor/docTheme";
import { stem } from "../client/wikilink";
import { Button } from "./ui/Button";

export function Editor(props: {
  path: string | null;
  value: string;
  mode: "livepreview" | "source";
  notePaths: string[];
  assetUrl: (relPath: string) => string;
  onChange: (value: string) => void;
  onOpenNote: (path: string) => void;
  onToggleMode: () => void;
}) {
  const viewRef = useRef<EditorView | null>(null);

  const resolve = useMemo(() => {
    const byStem = new Map<string, string>();
    for (const p of props.notePaths) byStem.set(stem(p), p);
    return (target: string) => byStem.get(stem(target)) ?? null;
  }, [props.notePaths]);

  const onOpenNote = props.onOpenNote;
  const resolveImage = useMemo(
    () => makeImageResolver(props.assetUrl),
    [props.assetUrl],
  );
  const extensions = useMemo(() => {
    const base = markdown({
      base: markdownLanguage,
      codeLanguages: markdownCodeLanguages,
    });
    const common = [base, docTheme, docHighlightStyle, EditorView.lineWrapping];
    const lp = livePreview({
      resolve,
      onOpenNote,
      onToggleCheckbox: (bracketOpen: number) => {
        const view = viewRef.current;
        if (!view) return;
        const change = toggleCheckboxChange(
          view.state.doc.toString(),
          bracketOpen,
        );
        view.dispatch({ changes: change });
      },
      resolveImage,
      onEditImage: (pos: number) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: EditorSelection.cursor(pos) });
      },
    });
    return props.mode === "livepreview" ? [...common, lp] : common;
  }, [props.mode, resolve, onOpenNote, resolveImage]);

  if (!props.path) {
    return (
      <div className="text-sm text-muted">
        No note open. Pick one from the list.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-muted">{props.path}</span>
        <Button variant="ghost" onClick={props.onToggleMode}>
          {props.mode === "livepreview" ? "Source" : "Live Preview"}
        </Button>
      </div>
      <div
        className={
          "flex-1 min-h-0 " +
          (props.mode === "livepreview"
            ? "cm-doc-livepreview"
            : "cm-doc-source")
        }
      >
        <CodeMirror
          value={props.value}
          height="100%"
          // Disable @uiw/react-codemirror's default light theme so our
          // transparent docTheme shows the graphite app background.
          theme="none"
          extensions={extensions}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            // Don't highlight every other occurrence of the selected text.
            highlightSelectionMatches: false,
          }}
          onChange={props.onChange}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
        />
      </div>
    </div>
  );
}
