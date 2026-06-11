import { useState } from "react";
import type { Settings as SettingsType } from "../store/store";
import { Input } from "./ui/Input";
import { SectionLabel } from "./ui/SectionLabel";

export function Settings(props: {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
}) {
  const s = props.settings;
  const [intervalStr, setIntervalStr] = useState(
    String(s.intervalAutoCommitMin),
  );
  return (
    <div className="flex flex-col gap-2 text-sm text-text">
      <span className="mb-1">
        <SectionLabel>Auto-commit</SectionLabel>
      </span>
      <label className="flex items-center gap-2 text-muted">
        <input
          type="checkbox"
          checked={s.idleAutoCommit}
          onChange={(e) => props.onChange({ idleAutoCommit: e.target.checked })}
        />
        Idle auto-commit
      </label>
      <label className="flex items-center gap-2 text-muted">
        <input
          type="checkbox"
          checked={s.intervalAutoCommit}
          onChange={(e) =>
            props.onChange({ intervalAutoCommit: e.target.checked })
          }
        />
        Interval auto-commit
      </label>
      <label className="flex items-center gap-2 text-muted">
        Interval (min)
        <Input
          type="number"
          min={1}
          className="w-16"
          value={intervalStr}
          onChange={(e) => {
            setIntervalStr(e.target.value);
            const n = Number(e.target.value);
            if (!isNaN(n) && n > 0)
              props.onChange({ intervalAutoCommitMin: n });
          }}
        />
      </label>
      <span className="mb-1 mt-2">
        <SectionLabel>Privacy</SectionLabel>
      </span>
      <label className="flex items-center gap-2 text-muted">
        <input
          type="checkbox"
          checked={s.loadRemoteImages}
          onChange={(e) =>
            props.onChange({ loadRemoteImages: e.target.checked })
          }
        />
        Load remote images
      </label>
    </div>
  );
}
