import { useEffect, useRef } from "react";

/** A positioned right-click menu for a tree note row. Closes on Escape, on an
 *  outside click, or after any item runs. */
export function TreeContextMenu(props: {
  x: number;
  y: number;
  onOpen: () => void;
  onOpenToSide: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        props.onClose();
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (fn: () => void) => () => {
    fn();
    props.onClose();
  };

  const item = (
    label: string,
    fn: () => void,
    danger = false,
    hint?: string,
  ) => (
    <button
      type="button"
      role="menuitem"
      onClick={run(fn)}
      className={
        "flex w-full items-center justify-between gap-6 rounded px-2.5 py-1.5 text-left text-xs hover:bg-surface-2 " +
        (danger ? "text-danger" : "text-text")
      }
    >
      <span>{label}</span>
      {hint && <span className="text-faint">{hint}</span>}
    </button>
  );

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
      style={{ left: props.x, top: props.y }}
      className="fixed z-50 w-44 rounded-lg border border-border bg-surface p-1 shadow-xl outline-none"
    >
      {item("Open", props.onOpen, false, "↵")}
      {item("Open to the side", props.onOpenToSide, false, "⌘↵")}
      <div className="my-1 h-px bg-border" />
      {item("Rename", props.onRename, false, "F2")}
      {item("Delete", props.onDelete, true)}
    </div>
  );
}
