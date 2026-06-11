import { Button } from "./ui/Button";

/** Surfaces the degraded "live updates unavailable" state and offers a manual
 *  refresh. Stacks above the error/notice toasts (bottom-28). */
export function LiveUpdatesBanner(props: {
  status: "ok" | "down";
  onRefresh: () => void;
}) {
  if (props.status === "ok") return null;
  return (
    <div
      role="status"
      className="fixed bottom-28 right-4 z-20 flex items-center gap-3 rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text shadow-lg"
    >
      <span>Live updates unavailable — data may be stale.</span>
      <Button variant="ghost" onClick={props.onRefresh}>
        Refresh
      </Button>
    </div>
  );
}
