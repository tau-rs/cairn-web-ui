import { useEffect, useState } from "react";
import { useCairn, useActions } from "../../app/cairnStore";
import { HistoryList } from "./HistoryList";
import { RestoreConfirmDialog } from "./RestoreConfirmDialog";
import type { RevisionEx } from "../../client/contractExt";

export function HistoryPane() {
  const actions = useActions();
  const activePath = useCairn((s) => s.activePath);
  const history = useCairn((s) => s.history);
  const historyPath = useCairn((s) => s.historyPath);
  const loading = useCairn((s) => s.historyLoading);
  const [pending, setPending] = useState<string | null>(null);

  // (Re)load history whenever the active note changes.
  useEffect(() => {
    void actions.loadHistory();
  }, [activePath, actions]);

  // Until the reload for the current note resolves, the loaded `history` still
  // belongs to the previous note — show the spinner instead of stale revisions.
  const stale = historyPath !== activePath;

  return (
    <>
      <HistoryList
        revisions={stale ? null : (history as RevisionEx[] | null)}
        loading={loading || stale}
        onView={(rev) => void actions.viewRevision(rev)}
        onRestore={(rev) => setPending(rev)}
        onName={(id) => actions.setUi({ nameVersionFor: id })}
      />
      <RestoreConfirmDialog
        open={pending !== null}
        revision={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void actions.restoreRevision(pending);
          setPending(null);
        }}
      />
    </>
  );
}
