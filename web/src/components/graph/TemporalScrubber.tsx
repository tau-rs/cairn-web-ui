import { useMemo, useState } from "react";
import type { Revision } from "../../contract";
import type { TemporalSelection } from "./temporalControls";
import { timelineBuckets, describeSelection } from "./timelineDensity";

/** Vault-history scrubber. `timeline` is newest-first; the UI renders
 *  oldest→newest (display index 0 = oldest = left). Two explicit modes:
 *  Browse (jump to a point) and Compare (diff two points). */
export function TemporalScrubber(props: {
  timeline: Revision[];
  selection: TemporalSelection;
  onSelect: (s: TemporalSelection) => void;
  counts: { notes: number; links: number } | null;
  delta: { added: number; removed: number } | null;
}) {
  const { timeline, selection, onSelect, counts, delta } = props;
  const n = timeline.length;
  const [mode, setMode] = useState<"browse" | "compare">(
    selection.kind === "compare" ? "compare" : "browse",
  );
  // compare endpoints as DISPLAY indices (0 = oldest); default full span.
  const [cmp, setCmp] = useState<{ from: number; to: number }>({
    from: 0,
    to: Math.max(0, n - 1),
  });

  const buckets = useMemo(() => timelineBuckets(timeline), [timeline]);
  const maxBar = Math.max(1, ...buckets.map((b) => b.count));
  const { state, detail } = describeSelection(selection, timeline);

  const toTl = (d: number) => n - 1 - d; // display idx → newest-first idx

  const browseDisplay =
    selection.kind === "snapshot" ? n - 1 - selection.at : n - 1;

  const setLive = () => {
    setMode("browse");
    onSelect({ kind: "live" });
  };
  const onBrowse = (displayIdx: number) =>
    onSelect({ kind: "snapshot", at: toTl(displayIdx) });

  const emitCompare = (fromD: number, toD: number) => {
    const from = Math.max(toTl(fromD), toTl(toD)); // older = higher tl index
    const to = Math.min(toTl(fromD), toTl(toD));
    if (from === to) onSelect({ kind: "snapshot", at: to });
    else onSelect({ kind: "compare", from, to });
  };
  const enterCompare = () => {
    setMode("compare");
    emitCompare(cmp.from, cmp.to);
  };

  const segBtn = (active: boolean) =>
    "rounded px-2 py-0.5 text-[11px] " +
    (active ? "bg-accent text-accent-fg" : "text-muted hover:text-text");

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-10 flex flex-col gap-1.5 rounded-md border border-border bg-surface/90 px-2 py-1.5">
      {/* banner — "where am I" */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold text-text">{state}</span>
        <span className="text-muted">{detail}</span>
        {counts && (
          <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-muted">
            {counts.notes} notes · {counts.links} links
          </span>
        )}
        {delta && (
          <span className="text-[11px] text-muted">
            <span className="text-emerald-400">+{delta.added}</span>
            {" / "}
            <span className="text-rose-400">−{delta.removed}</span>
          </span>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded border border-border">
          <button
            type="button"
            className={segBtn(mode === "browse")}
            onClick={() => setMode("browse")}
          >
            Browse
          </button>
          <button
            type="button"
            className={segBtn(mode === "compare")}
            onClick={enterCompare}
          >
            Compare
          </button>
        </div>
        <button
          type="button"
          aria-pressed={selection.kind === "live"}
          className={segBtn(selection.kind === "live")}
          onClick={setLive}
        >
          Live
        </button>

        {/* histogram backdrop + range control(s) */}
        <div className="relative flex flex-1 flex-col justify-end">
          <div className="flex h-5 items-end gap-[2px]" aria-hidden="true">
            {buckets.map((b, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-border"
                style={{ height: `${8 + (b.count / maxBar) * 92}%` }}
              />
            ))}
          </div>
          {mode === "browse" ? (
            <input
              type="range"
              aria-label="Timeline position"
              className="w-full accent-accent"
              min={0}
              max={Math.max(0, n - 1)}
              step={1}
              value={browseDisplay}
              onChange={(e) => onBrowse(Number(e.target.value))}
            />
          ) : (
            <div className="flex gap-2">
              <input
                type="range"
                aria-label="Compare from"
                className="w-full accent-accent"
                min={0}
                max={Math.max(0, n - 1)}
                step={1}
                value={cmp.from}
                onChange={(e) => {
                  const from = Number(e.target.value);
                  setCmp((c) => ({ ...c, from }));
                  emitCompare(from, cmp.to);
                }}
              />
              <input
                type="range"
                aria-label="Compare to"
                className="w-full accent-accent"
                min={0}
                max={Math.max(0, n - 1)}
                step={1}
                value={cmp.to}
                onChange={(e) => {
                  const to = Number(e.target.value);
                  setCmp((c) => ({ ...c, to }));
                  emitCompare(cmp.from, to);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
