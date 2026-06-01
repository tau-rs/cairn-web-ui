import { useState } from "react";
import { Button } from "./ui/Button";
import { CommitDialog } from "./CommitDialog";

export function CommitBar(props: {
  saving: boolean;
  dirty: boolean;
  uncommitted: boolean;
  lastCommit: string | null;
  committing: boolean;
  onCommit: (message: string) => void;
}) {
  const [commitOpen, setCommitOpen] = useState(false);
  const status = props.saving
    ? "Saving…"
    : props.dirty
      ? "Unsaved"
      : props.uncommitted
        ? "Saved · uncommitted"
        : "Saved";
  return (
    <>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted">{status}</span>
        {props.lastCommit && (
          <span className="text-faint">@{props.lastCommit}</span>
        )}
        <Button
          variant="primary"
          disabled={props.committing}
          onClick={() => setCommitOpen(true)}
        >
          Commit
        </Button>
      </div>
      <CommitDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        committing={props.committing}
        onCommit={props.onCommit}
      />
    </>
  );
}
