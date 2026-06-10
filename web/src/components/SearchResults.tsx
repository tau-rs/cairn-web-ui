import { IconButton } from "./ui/IconButton";
import { SectionLabel } from "./ui/SectionLabel";

export function SearchResults(props: {
  results: string[] | null;
  onOpen: (path: string) => void;
  onClose: () => void;
  title?: string;
}) {
  if (props.results === null) return null;
  return (
    <div
      data-testid="search-results"
      className="absolute left-2 top-12 z-10 flex max-h-[60vh] w-72 flex-col rounded border border-border bg-surface p-2 shadow-lg"
    >
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>
          {props.title ?? "Results"} ({props.results.length})
        </SectionLabel>
        <IconButton label="close" onClick={props.onClose}>
          ✕
        </IconButton>
      </div>
      {props.results.length === 0 ? (
        <span className="text-sm text-faint">No matches</span>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {props.results.map((path) => (
            <button
              key={path}
              className="block w-full truncate rounded px-2 py-1 text-left text-sm text-muted hover:bg-surface-2"
              onClick={() => props.onOpen(path)}
            >
              {path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
