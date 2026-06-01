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
    <div className="flex items-center gap-3 text-xs text-neutral-400">
      <span>{status}</span>
      {props.lastCommit && <span className="text-neutral-500">@{props.lastCommit}</span>}
      <button
        className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        disabled={props.committing}
        onClick={() => {
          const message = window.prompt("Commit message");
          if (message) props.onCommit(message);
        }}
      >
        Commit
      </button>
    </div>
  );
}
