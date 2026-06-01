import { useState } from "react";
import type { Settings as SettingsType } from "../store/store";

export function Settings(props: {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
}) {
  const s = props.settings;
  const [intervalStr, setIntervalStr] = useState(String(s.intervalAutoCommitMin));
  return (
    <div className="flex flex-col gap-2 text-sm text-neutral-300">
      <span className="text-xs uppercase tracking-wide text-neutral-500">Auto-commit</span>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={s.idleAutoCommit}
          onChange={(e) => props.onChange({ idleAutoCommit: e.target.checked })}
        />
        Idle auto-commit
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={s.intervalAutoCommit}
          onChange={(e) => props.onChange({ intervalAutoCommit: e.target.checked })}
        />
        Interval auto-commit
      </label>
      <label className="flex items-center gap-2">
        Interval (min)
        <input
          type="number"
          min={1}
          className="w-16 rounded bg-neutral-800 px-1"
          value={intervalStr}
          onChange={(e) => {
            setIntervalStr(e.target.value);
            const n = Number(e.target.value);
            if (!isNaN(n) && n > 0) props.onChange({ intervalAutoCommitMin: n });
          }}
        />
      </label>
    </div>
  );
}
