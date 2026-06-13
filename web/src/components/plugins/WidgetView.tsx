import { useActions } from "../../app/cairnStore";
import type { PluginWidget } from "../../contract/PluginWidget";
import { pluginIconNode } from "./pluginIcon";

/**
 * Renders a single host-owned plugin widget descriptor. All text flows through
 * React's auto-escaping — that is the XSS barrier; plugins never inject HTML.
 * Clicks route to the store's plugin dispatcher.
 */
export function WidgetView({
  plugin,
  widget,
}: {
  plugin: string;
  widget: PluginWidget;
}) {
  const { invokePlugin } = useActions();

  switch (widget.kind) {
    case "text":
      return (
        <span
          className={widget.muted ? "text-xs text-faint" : "text-sm text-muted"}
        >
          {widget.text}
        </span>
      );

    case "action":
      return (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text hover:border-accent"
          onClick={() =>
            void invokePlugin(plugin, widget.command, widget.args ?? null)
          }
        >
          {widget.icon && pluginIconNode(widget.icon)}
          {widget.label}
        </button>
      );

    case "list":
      return (
        <ul>
          {widget.items.map((it) => {
            const cmd = it.command;
            const content = (
              <>
                {it.icon && pluginIconNode(it.icon)}
                {it.label}
              </>
            );
            return (
              <li key={it.id}>
                {cmd != null ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() =>
                      void invokePlugin(plugin, cmd, it.args ?? null)
                    }
                  >
                    {content}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      );

    default:
      return null;
  }
}
