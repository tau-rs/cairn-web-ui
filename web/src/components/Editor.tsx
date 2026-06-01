import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { MarkdownView } from "./MarkdownView";

export function Editor(props: {
  path: string | null;
  value: string;
  mode: "rendered" | "source";
  notePaths: string[];
  onChange: (value: string) => void;
  onOpenNote: (path: string) => void;
  onToggleMode: () => void;
}) {
  if (!props.path) {
    return (
      <div className="text-sm text-neutral-500">
        No note open. Pick one from the list.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-neutral-300">{props.path}</span>
        <button
          className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:bg-neutral-800"
          onClick={props.onToggleMode}
        >
          {props.mode === "rendered" ? "Edit source" : "Done"}
        </button>
      </div>
      {props.mode === "rendered" ? (
        <div className="h-full overflow-auto">
          <MarkdownView
            contents={props.value}
            notePaths={props.notePaths}
            onOpenNote={props.onOpenNote}
          />
        </div>
      ) : (
        <CodeMirror
          value={props.value}
          height="100%"
          theme="dark"
          extensions={[markdown()]}
          onChange={props.onChange}
        />
      )}
    </div>
  );
}
