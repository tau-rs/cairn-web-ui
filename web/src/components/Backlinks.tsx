export function Backlinks(props: {
  paths: string[];
  onOpen: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
        Backlinks
      </span>
      {props.paths.length === 0 ? (
        <span className="text-neutral-600">No backlinks</span>
      ) : (
        props.paths.map((path) => (
          <button
            key={path}
            className="truncate rounded px-2 py-1 text-left text-neutral-300 hover:bg-neutral-800"
            onClick={() => props.onOpen(path)}
          >
            {path}
          </button>
        ))
      )}
    </div>
  );
}
