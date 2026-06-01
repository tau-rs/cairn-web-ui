import { Button } from "./ui/Button";

export function CommitBar(props: {
  saving: boolean;
  dirty: boolean;
  uncommitted: boolean;
  lastCommit: string | null;
  committing: boolean;
  onCommit: (message: string) => void;
}) {
  const status = props.saving
    ? "Saving…"
    : props.dirty
      ? "Unsaved"
      : props.uncommitted
        ? "Saved · uncommitted"
        : "Saved";
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-muted">{status}</span>
      {props.lastCommit && (
        <span className="text-faint">@{props.lastCommit}</span>
      )}
      <Button
        variant="primary"
        disabled={props.committing}
        onClick={() => {
          const message = window.prompt("Commit message");
          if (message) props.onCommit(message);
        }}
      >
        Commit
      </Button>
    </div>
  );
}
