import type { PluginSummary } from "../../contract";
import type { PaletteCommand } from "../command-palette/CommandPalette";

const PREFIX = "plugin:";

/** Flatten loaded plugins' commands into palette commands. */
export function toPaletteCommands(plugins: PluginSummary[]): PaletteCommand[] {
  const out: PaletteCommand[] = [];
  for (const p of plugins) {
    for (const c of p.commands) {
      out.push({
        id: `${PREFIX}${p.id}/${c.id}`,
        label: `${p.name}: ${c.title}`,
      });
    }
  }
  return out;
}

/** Parse a palette command id back to {plugin, command}; null if not a plugin id.
 *  Splits on the FIRST "/" after the prefix (command ids may contain "/"). */
export function parsePluginCommandId(
  id: string,
): { plugin: string; command: string } | null {
  if (!id.startsWith(PREFIX)) return null;
  const rest = id.slice(PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { plugin: rest.slice(0, slash), command: rest.slice(slash + 1) };
}
