import type { ColorGroup } from "./colorGroups";

export function GraphGroupsPanel(props: {
  groups: ColorGroup[];
  onChange: (next: ColorGroup[]) => void;
}) {
  const { groups, onChange } = props;
  const update = (i: number, patch: Partial<ColorGroup>) =>
    onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i: number) => onChange(groups.filter((_, j) => j !== i));
  const add = () =>
    onChange([...groups, { kind: "path", query: "", color: "#6366f1" }]);

  return (
    <div className="w-52 rounded-lg border border-border bg-surface p-3 shadow-2xl">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-faint">
        Groups
      </div>
      {groups.map((g, i) => (
        <div key={i} className="mb-2 flex items-center gap-1.5">
          <select
            aria-label="Group kind"
            className="rounded border border-border bg-bg px-1 py-0.5 text-[11px] text-text"
            value={g.kind}
            onChange={(e) =>
              update(i, { kind: e.target.value as ColorGroup["kind"] })
            }
          >
            <option value="path">Path</option>
            <option value="tag">Tag</option>
          </select>
          <input
            type="text"
            aria-label="Group query"
            className="min-w-0 flex-1 rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text"
            value={g.query}
            onChange={(e) => update(i, { query: e.target.value })}
          />
          <input
            type="color"
            aria-label="Group color"
            className="h-5 w-5 flex-none rounded border border-border bg-bg"
            value={g.color}
            onChange={(e) => update(i, { color: e.target.value })}
          />
          <button
            type="button"
            aria-label="Remove group"
            className="flex-none text-faint hover:text-text"
            onClick={() => remove(i)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-[11px] text-accent hover:underline"
        onClick={add}
      >
        + Add group
      </button>
    </div>
  );
}
