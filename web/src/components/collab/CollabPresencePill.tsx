import { Button } from "../ui/Button";
import type { CollabPresence } from "../../store/collabSlice";

/** Bottom-right presence for the live-collab session on the open note. Binary
 *  "Live edits" (no roster is derivable from the wire). When the buffer is dirty
 *  and changes are pending, a non-destructive "N live changes — Reload" nudge.
 *  Stacks above LiveUpdatesBanner's bottom-28 corner slot at bottom-40 so the
 *  two never overlap. */
export function CollabPresencePill(props: {
  collab: CollabPresence;
  dirty: boolean;
  onReload: () => void;
}) {
  const { collab, dirty, onReload } = props;

  // The dirty nudge persists across live-decay: pendingCount stays >0 even
  // after `live` flips false (LIVE_DECAY_MS quiet), and the nudge must stay
  // visible until the user acts on it (Reload) or the buffer is saved/reset.
  if (dirty && collab.pendingCount > 0) {
    const n = collab.pendingCount;
    return (
      <div
        role="status"
        className="fixed bottom-40 right-4 z-20 flex items-center gap-3 rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text shadow-lg"
      >
        <span>
          {n} live {n === 1 ? "change" : "changes"}
        </span>
        <Button variant="ghost" onClick={onReload}>
          Reload
        </Button>
      </div>
    );
  }

  if (!collab.live) return null;

  return (
    <div
      role="status"
      className="fixed bottom-40 right-4 z-20 flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted shadow-lg"
    >
      <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
      <span>Live edits</span>
    </div>
  );
}
