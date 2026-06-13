import { useRef } from "react";

/** Draggable vertical divider between split panes. Reports a new left-pane
 *  fraction via `onRatio`. Keyboard-accessible (←/→ nudge by 0.02). */
export function Divider(props: {
  ratio: number;
  onRatio: (ratio: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      props.onRatio((ev.clientX - rect.left) / rect.width);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      props.onRatio(props.ratio + 0.02);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      props.onRatio(props.ratio - 0.02);
    }
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-accent focus:bg-accent focus:outline-none"
    />
  );
}
