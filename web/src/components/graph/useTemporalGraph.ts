import { useEffect, useMemo, useRef, useState } from "react";
import { useCairn, useActions } from "../../app/cairnStore";
import {
  selectionToRequest,
  loadTemporalOpen,
  saveTemporalOpen,
  loadStructuralOnly,
  saveStructuralOnly,
  type TemporalSelection,
} from "./temporalControls";
import { debounce } from "../../util/timer";

const SNAPSHOT_DEBOUNCE_MS = 150;

/** Wires the vault-history scrubber to the store's temporal data. Loads the
 *  whole-vault timeline once on mount; snapshot/diff loads are debounced so
 *  dragging the scrubber doesn't fire a full-vault graph_at per tick. Returns
 *  the effective source (null in live mode → caller uses the live graph). */
export function useTemporalGraph() {
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

  const [structuralOnly, setStructuralOnlyState] = useState(loadStructuralOnly);

  // Load the vault-wide timeline once.
  useEffect(() => {
    void actions.loadVaultTimeline();
  }, [actions]);

  // The structural list is fetched lazily the first time the toggle turns on,
  // then reused (parallel to the always-loaded full timeline).
  useEffect(() => {
    if (structuralOnly && temporal.structuralTimeline === null) {
      void actions.loadStructuralTimeline();
    }
  }, [structuralOnly, temporal.structuralTimeline, actions]);

  // Full timeline while the structural list is still loading, so the scrubber
  // never disappears; selection is reset to Live on toggle, so no misindex.
  const displayTimeline = structuralOnly
    ? (temporal.structuralTimeline ?? temporal.timeline)
    : temporal.timeline;

  // Flipping the filter swaps to a different-length/-ordered list, so a stored
  // snapshot/compare index would point at the wrong revision. Reset to Live.
  const setStructuralOnly = (next: boolean) => {
    setStructuralOnlyState(next);
    saveStructuralOnly(next);
    setSelection({ kind: "live" });
  };

  const request = useMemo(
    () => selectionToRequest(selection, displayTimeline),
    [selection, displayTimeline],
  );

  const requestRef = useRef(request);
  requestRef.current = request;
  const dispatch = useMemo(
    () =>
      debounce(() => {
        const r = requestRef.current;
        if (r.mode === "snapshot") void actions.loadSnapshot(r.revision);
        else if (r.mode === "compare") void actions.loadDiff(r.from, r.to);
      }, SNAPSHOT_DEBOUNCE_MS),
    [actions],
  );

  useEffect(() => {
    if (request.mode === "live") {
      dispatch.cancel();
      actions.clearTemporal();
    } else {
      dispatch();
    }
    return () => dispatch.cancel();
  }, [request, dispatch, actions]);

  const mode = request.mode;
  const source = mode === "live" ? null : temporal.snapshot;
  const diff = mode === "compare" ? temporal.diff : null;

  return {
    timeline: displayTimeline,
    selection,
    setSelection,
    open,
    setOpen,
    mode,
    source,
    diff,
    structuralOnly,
    setStructuralOnly,
  };
}
