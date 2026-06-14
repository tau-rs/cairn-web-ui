import type { Revision } from "../../contract";
import { SectionLabel } from "../ui/SectionLabel";
import { Spinner } from "../ui/Spinner";
import { relativeTime, absoluteTime } from "./formatRevision";

export function HistoryList(props: {
  revisions: Revision[] | null;
  loading: boolean;
  onView: (revision: string) => void;
  onRestore: (revision: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="mb-1">
        <SectionLabel>History</SectionLabel>
      </span>
      {props.loading ? (
        <span className="flex items-center gap-2 text-faint">
          <Spinner label="Loading history" /> Loading…
        </span>
      ) : !props.revisions || props.revisions.length === 0 ? (
        <span className="text-faint">No history</span>
      ) : (
        props.revisions.map((r) => (
          <div key={r.id} className="rounded px-2 py-1.5 hover:bg-surface-2">
            <div className="truncate text-text">{r.message}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
              <span className="font-mono">{r.id}</span>
              <span>·</span>
              <span title={absoluteTime(r.timestamp_secs)}>
                {relativeTime(r.timestamp_secs)}
              </span>
              <span>·</span>
              <span className="truncate">{r.author}</span>
            </div>
            <div className="mt-1 flex gap-2">
              <button
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
                onClick={() => props.onView(r.id)}
              >
                View
              </button>
              <button
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
                onClick={() => props.onRestore(r.id)}
              >
                Restore
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
