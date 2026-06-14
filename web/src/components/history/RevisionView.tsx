import { useState } from "react";
import { Button } from "../ui/Button";
import { lineDiff, type DiffLine } from "./lineDiff";

function DiffRow({ row }: { row: DiffLine }) {
  const sym = row.type === "add" ? "+" : row.type === "del" ? "-" : " ";
  const tone =
    row.type === "add"
      ? "bg-success-bg text-success"
      : row.type === "del"
        ? "bg-danger-bg text-danger"
        : "text-muted";
  return (
    <div className={`flex ${tone}`}>
      <span className="w-10 shrink-0 select-none px-1 text-right text-faint">
        {row.oldLine ?? ""}
      </span>
      <span className="w-10 shrink-0 select-none px-1 text-right text-faint">
        {row.newLine ?? ""}
      </span>
      <span className="w-4 shrink-0 select-none text-center">{sym}</span>
      <span className="whitespace-pre-wrap break-words">{row.text}</span>
    </div>
  );
}

// Phase 2: diff-vs-current with a Diff/Full toggle (default diff). The old side
// is the fetched revision; the new side is the live working buffer (`current`).
export function RevisionView(props: {
  revision: string;
  contents: string;
  current: string;
  onBack: () => void;
  onRestore: () => void;
}) {
  const [mode, setMode] = useState<"diff" | "full">("diff");
  const rows = mode === "diff" ? lineDiff(props.contents, props.current) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-accent/40 bg-accent/10 px-3 py-2 text-xs text-text">
        <span>
          Viewing <span className="font-mono">{props.revision}</span> —
          read-only
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-border">
            <button
              type="button"
              aria-pressed={mode === "diff"}
              onClick={() => setMode("diff")}
              className={
                mode === "diff"
                  ? "bg-accent px-2 py-0.5 text-accent-fg"
                  : "px-2 py-0.5 text-muted hover:text-text"
              }
            >
              Diff
            </button>
            <button
              type="button"
              aria-pressed={mode === "full"}
              onClick={() => setMode("full")}
              className={
                mode === "full"
                  ? "bg-accent px-2 py-0.5 text-accent-fg"
                  : "px-2 py-0.5 text-muted hover:text-text"
              }
            >
              Full
            </button>
          </div>
          <Button variant="ghost" onClick={props.onBack}>
            ← Back to current
          </Button>
          <Button variant="primary" onClick={props.onRestore}>
            Restore
          </Button>
        </div>
      </div>
      {mode === "diff" ? (
        <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-sm">
          {rows.map((row, idx) => (
            <DiffRow key={idx} row={row} />
          ))}
        </div>
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-sm text-muted">
          {props.contents}
        </pre>
      )}
    </div>
  );
}
