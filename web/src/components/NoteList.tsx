export function NoteList(props: {
  paths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onNew: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Notes
        </span>
        <button
          className="rounded px-1 text-neutral-300 hover:bg-neutral-800"
          onClick={() => {
            const path = window.prompt("New note path (e.g. notes/idea.md)");
            if (path) props.onNew(path);
          }}
        >
          + New note
        </button>
      </div>
      {props.paths.map((path) => (
        <div
          key={path}
          className={`group flex items-center justify-between rounded px-2 py-1 hover:bg-neutral-800 ${
            path === props.activePath
              ? "bg-neutral-800 text-white"
              : "text-neutral-300"
          }`}
        >
          <button
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => props.onOpen(path)}
          >
            {path}
          </button>
          <button
            className="ml-1 hidden text-neutral-500 hover:text-red-400 group-hover:block"
            aria-label={`delete ${path}`}
            onClick={() => props.onDelete(path)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
