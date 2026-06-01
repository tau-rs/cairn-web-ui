import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { livePreview } from "./editor/livePreview";
import { stem } from "../client/wikilink";
import { Button } from "./ui/Button";

export function Editor(props: {
  path: string | null;
  value: string;
  mode: "livepreview" | "source";
  notePaths: string[];
  onChange: (value: string) => void;
  onOpenNote: (path: string) => void;
  onToggleMode: () => void;
}) {
  const resolve = useMemo(() => {
    const byStem = new Map<string, string>();
    for (const p of props.notePaths) byStem.set(stem(p), p);
    return (target: string) => byStem.get(stem(target)) ?? null;
  }, [props.notePaths]);

  const onOpenNote = props.onOpenNote;
  const extensions = useMemo(() => {
    const base = markdown({ base: markdownLanguage });
    return props.mode === "livepreview"
      ? [base, livePreview({ resolve, onOpenNote })]
      : [base];
  }, [props.mode, resolve, onOpenNote]);

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
      <CodeMirror
        value={props.value}
        height="100%"
        theme="dark"
        extensions={extensions}
        onChange={props.onChange}
      />
    </div>
  );
}
