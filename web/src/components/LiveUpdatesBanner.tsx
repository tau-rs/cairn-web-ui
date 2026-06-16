import { Button } from "./ui/Button";

/** Surfaces the live-update channel state in the bottom-right slot (above the
 *  error/notice toasts, bottom-28). Three states, mutually exclusive:
 *  - "ok": nothing.
 *  - "reconnecting": a calm pill (pulsing dot, no action) during silent backoff.
 *  - "down": the hard "data may be stale" banner with a manual Refresh. */
export function LiveUpdatesBanner(props: {
  status: "ok" | "reconnecting" | "down";
  onRefresh: () => void;
}) {
  if (props.status === "ok") return null;

  if (props.status === "reconnecting") {
    return (
      <div
        role="status"
        className="fixed bottom-28 right-4 z-20 flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted shadow-lg"
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-full bg-accent animate-pulse"
        />
        <span>Reconnecting…</span>
      </div>
    );
  }

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
