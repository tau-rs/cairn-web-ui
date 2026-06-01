import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";

export function Editor(props: {
  path: string | null;
  value: string;
  mode: "rich" | "raw";
  onChange: (value: string) => void;
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
          {props.mode === "rich" ? "Switch to raw" : "Switch to rich"}
        </button>
      </div>
      {props.mode === "rich" ? (
        <CodeMirror
          value={props.value}
          height="100%"
          theme="dark"
          extensions={[markdown()]}
          onChange={props.onChange}
        />
      ) : (
        <textarea
          className="h-full w-full resize-none bg-neutral-950 p-2 font-mono text-sm text-neutral-100 outline-none"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </div>
  );
}
