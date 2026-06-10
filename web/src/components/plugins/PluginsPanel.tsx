import { SectionLabel } from "../ui/SectionLabel";
import type { PluginSummary } from "../../contract";

export function PluginsPanel(props: { plugins: PluginSummary[] }) {
  return (
    <div className="flex flex-col gap-1 text-sm text-text">
      <span className="mb-1">
        <SectionLabel>Plugins</SectionLabel>
      </span>
      {props.plugins.length === 0 ? (
        <span className="text-xs text-faint">No plugins loaded</span>
      ) : (
        props.plugins.map((p) => (
          <div key={p.id} className="flex flex-col gap-0.5">
            <span className="text-muted">
              {p.name} <span className="text-faint">v{p.version}</span>
            </span>
            {p.commands.map((c) => (
              <span key={c.id} className="pl-3 text-xs text-faint">
                {c.title}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
