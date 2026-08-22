import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

/** Blocking confirm for the live-collab "Reload" action. Reloading force-
 *  replaces the buffer from disk, discarding unsaved local edits, so a stray
 *  click must clear this gate first. State (open flag) lives in the `ui` slice;
 *  this is presentational. */
export function CollabReloadDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const close = () => onOpenChange(false);
  const confirm = () => {
    onConfirm();
    close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Discard unsaved edits?"
      description="Reloading replaces this note with the live version. Your unsaved local edits will be lost."
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="bg-danger text-danger-bg hover:bg-danger/90"
          onClick={confirm}
        >
          Discard &amp; reload
        </Button>
      </div>
    </Modal>
  );
}
