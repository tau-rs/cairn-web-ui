import { useState } from "react";
import { Button } from "./ui/Button";
import { SectionLabel } from "./ui/SectionLabel";
import { NewNoteDialog } from "./NewNoteDialog";

export function NoteList(props: {
  paths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onNew: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [newOpen, setNewOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>Notes</SectionLabel>
        <Button variant="ghost" onClick={() => setNewOpen(true)}>
          + New note
        </Button>
      </div>
      {props.paths.map((path) => (
        <div
          key={path}
          className={`group flex items-center justify-between rounded px-2 py-1 ${
            path === props.activePath
              ? "bg-surface-2 text-text"
              : "text-muted hover:bg-surface-2 hover:text-text"
          }`}
        >
          <button
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => props.onOpen(path)}
          >
            {path}
          </button>
          <button
            className="ml-1 hidden text-faint hover:text-danger group-hover:block"
            aria-label={`delete ${path}`}
            onClick={() => props.onDelete(path)}
          >
            ✕
          </button>
        </div>
      ))}
      <NewNoteDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={props.onNew}
      />
    </div>
  );
}
