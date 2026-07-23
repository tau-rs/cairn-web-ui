import type { Revision } from "../../contract";
import type { TemporalSelection } from "./temporalControls";

/** A horizontal timeline scrubber. `timeline` is newest-first; ticks render
 *  oldest→newest, left→right. One tick = snapshot; picking a second tick while a
 *  snapshot is active forms a compare range (older index = from, newer = to). */
export function TemporalScrubber(props: {
  timeline: Revision[];
  selection: TemporalSelection;
  onSelect: (s: TemporalSelection) => void;
}) {
  const { timeline, selection, onSelect } = props;
  // Render oldest→newest: map display position → newest-first index.
  const order = timeline.map((_, i) => timeline.length - 1 - i); // display→timeline idx

  const activeIdx =
    selection.kind === "snapshot"
      ? selection.at
      : selection.kind === "compare"
        ? selection.to
        : null;

  const onTick = (idx: number) => {
    if (selection.kind === "snapshot" && selection.at !== idx) {
      const from = Math.max(selection.at, idx); // older = higher index
      const to = Math.min(selection.at, idx); // newer = lower index
      onSelect({ kind: "compare", from, to });
    } else {
      onSelect({ kind: "snapshot", at: idx });
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-md border border-border bg-surface/90 px-2 py-1.5">
      <button
        type="button"
        aria-pressed={selection.kind === "live"}
        className={
          "rounded px-2 py-0.5 text-[11px] " +
          (selection.kind === "live"
            ? "bg-accent text-accent-fg"
            : "text-muted hover:text-text")
        }
        onClick={() => onSelect({ kind: "live" })}
      >
        Live
      </button>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {order.map((idx) => {
          const rev = timeline[idx];
          const on = activeIdx === idx;
          return (
            <button
              key={rev.id}
              type="button"
              aria-pressed={on}
              title={`${rev.id} — ${rev.message}`}
              aria-label={`Revision ${rev.message}`}
              className={
                "h-4 w-2 shrink-0 rounded-sm " +
                (on ? "bg-accent" : "bg-border hover:bg-muted")
              }
              onClick={() => onTick(idx)}
            />
          );
        })}
      </div>
    </div>
  );
}
