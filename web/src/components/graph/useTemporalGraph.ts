import { useEffect, useMemo, useState } from "react";
import { useCairn, useActions } from "../../app/cairnStore";
import {
  selectionToRequest,
  loadTemporalOpen,
  saveTemporalOpen,
  type TemporalSelection,
} from "./temporalControls";

/** Wires the temporal controls (view state) to the store's temporal data. Owns
 *  the scrubber selection; runs the timeline load on note change and the
 *  snapshot/diff load on selection change; returns the effective data source
 *  (null in live mode → caller uses the live graph). */
export function useTemporalGraph(activePath: string | null) {
  const temporal = useCairn((s) => s.temporal);
  const actions = useActions();
  const [selection, setSelection] = useState<TemporalSelection>({
    kind: "live",
  });
  const [open, setOpenState] = useState(loadTemporalOpen);
  const setOpen = (o: boolean) => {
    setOpenState(o);
    saveTemporalOpen(o);
  };

  // Effect A: note change → (re)load its timeline and reset to live.
  useEffect(() => {
    setSelection({ kind: "live" });
    if (activePath) void actions.loadTimeline(activePath);
  }, [activePath, actions]);

  const request = useMemo(
    () => selectionToRequest(selection, temporal.timeline),
    [selection, temporal.timeline],
  );

  // Effect B: request change → fetch the matching temporal data.
  useEffect(() => {
    if (request.mode === "live") actions.clearTemporal();
    else if (request.mode === "snapshot")
      void actions.loadSnapshot(request.revision);
    else void actions.loadDiff(request.from, request.to);
  }, [request, actions]);

  const mode = request.mode;
  const source = mode === "live" ? null : temporal.snapshot;
  const diff = mode === "compare" ? temporal.diff : null;

  return {
    timeline: temporal.timeline,
    selection,
    setSelection,
    open,
    setOpen,
    disabled: !activePath,
    mode,
    source,
    diff,
  };
}
