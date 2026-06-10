import { IconButton } from "./ui/IconButton";
import { SectionLabel } from "./ui/SectionLabel";
import { splitSnippet, type SearchSnippet } from "./searchHighlight";

export function SearchResults(props: {
  results: string[] | null;
  onOpen: (path: string) => void;
  onClose: () => void;
  title?: string;
  snippets?: Record<string, SearchSnippet>;
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
          {props.results.map((path) => {
            const snip = props.snippets?.[path];
            return (
              <button
                key={path}
                aria-label={path}
                className="block w-full rounded px-2 py-1 text-left hover:bg-surface-2"
                onClick={() => props.onOpen(path)}
              >
                <span className="block truncate text-sm text-muted">
                  {path}
                </span>
                {snip && (
                  <span className="mt-0.5 block truncate text-xs text-faint">
                    {splitSnippet(snip.snippet, snip.highlights).map(
                      (seg, i) =>
                        seg.match ? (
                          <mark key={i} className="bg-transparent text-accent">
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        ),
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
