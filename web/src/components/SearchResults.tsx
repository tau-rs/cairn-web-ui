export function SearchResults(props: {
  results: string[] | null;
  onOpen: (path: string) => void;
  onClose: () => void;
}) {
  if (props.results === null) return null;
  return (
    <div
      data-testid="search-results"
      className="absolute left-2 top-12 z-10 w-72 rounded border border-neutral-700 bg-neutral-900 p-2 shadow-lg"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Results ({props.results.length})
        </span>
        <button
          className="text-neutral-400 hover:text-white"
          aria-label="close"
          onClick={props.onClose}
        >
          ✕
        </button>
      </div>
      {props.results.length === 0 ? (
        <span className="text-sm text-neutral-600">No matches</span>
      ) : (
        props.results.map((path) => (
          <button
            key={path}
            className="block w-full truncate rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-neutral-800"
            onClick={() => props.onOpen(path)}
          >
            {path}
          </button>
        ))
      )}
    </div>
  );
}
