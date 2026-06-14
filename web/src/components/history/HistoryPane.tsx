import { useEffect, useState } from "react";
import { useCairn, useActions } from "../../app/cairnStore";
import { HistoryList } from "./HistoryList";
import { RestoreConfirmDialog } from "./RestoreConfirmDialog";

export function HistoryPane() {
  const actions = useActions();
  const activePath = useCairn((s) => s.activePath);
  const history = useCairn((s) => s.history);
  const loading = useCairn((s) => s.historyLoading);
  const [pending, setPending] = useState<string | null>(null);

  // (Re)load history whenever the active note changes.
  useEffect(() => {
    void actions.loadHistory();
  }, [activePath, actions]);

  return (
    <>
      <HistoryList
        revisions={history}
        loading={loading}
        onView={(rev) => void actions.viewRevision(rev)}
        onRestore={(rev) => setPending(rev)}
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
