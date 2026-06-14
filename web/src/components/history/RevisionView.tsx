import { Button } from "../ui/Button";

// Phase 1: read-only content. Phase 2 will add `mode: "full" | "diff"` and a
// diff renderer; the `mode` prop is the seam (kept out of v1 — no diff dep yet).
export function RevisionView(props: {
  revision: string;
  contents: string;
  onBack: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-accent/40 bg-accent/10 px-3 py-2 text-xs text-text">
        <span>
          Viewing <span className="font-mono">{props.revision}</span> —
          read-only
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={props.onBack}>
            ← Back to current
          </Button>
          <Button variant="primary" onClick={props.onRestore}>
            Restore
          </Button>
        </div>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-sm text-muted">
        {props.contents}
      </pre>
    </div>
  );
}
