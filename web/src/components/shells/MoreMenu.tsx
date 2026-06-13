import { Settings as SettingsIcon, GitCommit } from "lucide-react";
import type { ComponentType } from "react";
import { useActions } from "../../app/cairnStore";

/** Mobile "More" tab: lower-frequency surfaces. Tags live in Files; Plugins in Settings. */
export function MoreMenu() {
  const actions = useActions();
  const items: {
    label: string;
    Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
    onClick: () => void;
  }[] = [
    {
      label: "Settings",
      Icon: SettingsIcon,
      onClick: () => actions.setUi({ settingsOpen: true }),
    },
    {
      label: "Commit changes",
      Icon: GitCommit,
      onClick: () => actions.setUi({ commitOpen: true }),
    },
  ];
  return (
    <div className="flex flex-col p-2">
      {items.map(({ label, Icon, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-text hover:bg-surface-2"
        >
          <Icon size={18} aria-hidden={true} />
          {label}
        </button>
      ))}
    </div>
  );
}
