import { useState } from "react";
import type { RevisionEx } from "../../client/contractExt";
import { groupRevisions } from "./groupRevisions";
import { versionWordDelta } from "./versionSummary";
import { relativeTime, absoluteTime } from "./formatRevision";
import { Button } from "../ui/Button";

function Row(props: {
  r: RevisionEx;
  onView: (id: string) => void;
  onRestore: (id: string) => void;
  onName: (id: string) => void;
}) {
  const { r } = props;
  const delta = versionWordDelta(r);
  return (
    <div className="flex flex-col gap-0.5 rounded px-1.5 py-1 hover:bg-surface-2">
      <div className="flex items-center gap-1.5">
        <span
          className={
            "min-w-0 flex-1 truncate " +
            (r.is_named ? "font-semibold text-text" : "text-text")
          }
        >
          {r.message}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {r.is_named && r.name && (
          <span className="rounded bg-accent/15 px-1 text-accent">
            {r.name}
          </span>
        )}
        <span title={absoluteTime(r.timestamp_secs)}>
          {relativeTime(r.timestamp_secs)}
        </span>
        {delta && (
          <span>
            +{delta.added}/&minus;{delta.removed} words
          </span>
        )}
        <span className="grow" />
        <Button variant="ghost" onClick={() => props.onView(r.id)}>
          View
        </Button>
        <Button variant="ghost" onClick={() => props.onRestore(r.id)}>
          Restore
        </Button>
        <Button variant="ghost" onClick={() => props.onName(r.id)}>
          Name…
        </Button>
      </div>
    </div>
  );
}

export function HistoryList(props: {
  revisions: RevisionEx[] | null;
  loading: boolean;
  onView: (id: string) => void;
  onRestore: (id: string) => void;
  onName: (id: string) => void;
}) {
  const [namedOnly, setNamedOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (props.loading || props.revisions === null)
    return <div className="p-2 text-sm text-muted">Loading…</div>;
  if (props.revisions.length === 0)
    return <div className="p-2 text-sm text-muted">No versions yet.</div>;

  const revs = namedOnly
    ? props.revisions.filter((r) => r.is_named)
    : props.revisions;
  const days = groupRevisions(revs, Date.now() / 1000);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex items-center gap-2 px-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={namedOnly}
          onChange={(e) => setNamedOnly(e.target.checked)}
        />
        Named only
      </label>
      {days.map((day) => (
        <div key={day.label} className="flex flex-col gap-0.5">
          <div className="px-1.5 pt-1 text-xs font-medium uppercase tracking-wide text-faint">
            {day.label}
          </div>
          {day.sessions.map((session) => (
            <div key={session.head.id} className="flex flex-col gap-0.5">
              <Row
                r={session.head}
                onView={props.onView}
                onRestore={props.onRestore}
                onName={props.onName}
              />
              {session.rest.length > 0 && !expanded.has(session.head.id) && (
                <button
                  type="button"
                  className="self-start px-1.5 text-xs text-muted hover:text-text"
                  onClick={() => toggle(session.head.id)}
                >
                  {session.rest.length} more in this session…
                </button>
              )}
              {expanded.has(session.head.id) &&
                session.rest.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    onView={props.onView}
                    onRestore={props.onRestore}
                    onName={props.onName}
                  />
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
