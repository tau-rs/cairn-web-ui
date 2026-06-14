import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export function RestoreConfirmDialog(props: {
  open: boolean;
  revision: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Restore this version?"
      description="This overwrites your working copy. Your current edits become uncommitted changes you can still commit or discard."
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={props.onConfirm}>
          Restore
        </Button>
      </div>
    </Modal>
  );
}
