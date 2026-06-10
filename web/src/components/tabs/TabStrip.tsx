import { stem } from "../../client/wikilink";

export interface TabView {
  path: string;
  preview: boolean;
  dirty: boolean;
}

export function TabStrip(props: {
  tabs: TabView[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onPin: (path: string) => void;
  onClose: (path: string) => void;
}) {
  if (props.tabs.length === 0) return null;
  return (
    <div
      role="tablist"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface"
    >
      {props.tabs.map((t) => {
        const active = t.path === props.activePath;
        const label = stem(t.path);
        return (
          <div
            key={t.path}
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={t.path}
            onClick={() => props.onSelect(t.path)}
            onDoubleClick={() => props.onPin(t.path)}
            className={
              "relative flex cursor-pointer items-center gap-2 whitespace-nowrap border-r border-border px-3 text-xs " +
              (active
                ? "bg-surface-2 text-text"
                : "text-muted hover:bg-surface-2 hover:text-text")
            }
          >
            {active && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
            )}
            <span className={t.preview ? "italic" : ""}>{label}</span>
            {t.dirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            <button
              type="button"
              aria-label={`close ${label}`}
              className="text-faint hover:text-text"
              onClick={(e) => {
                e.stopPropagation();
                props.onClose(t.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
