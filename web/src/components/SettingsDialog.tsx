import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Settings } from "./Settings";
import type { Settings as SettingsType } from "../store/store";

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
}) {
  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="Settings">
      <Settings settings={settings} onChange={onChange} />
      <div className="mt-3 flex justify-end">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
