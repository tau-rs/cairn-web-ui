import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export function CommitDialog({
  open,
  onOpenChange,
  committing,
  onCommit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  committing: boolean;
  onCommit: (message: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const submit = () => {
    const m = msg.trim();
    if (!m) return;
    onCommit(m);
    setMsg("");
    onOpenChange(false);
  };
  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Commit"
      description="Describe this change"
    >
      <Input
        autoFocus
        placeholder="Describe this change"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!msg.trim() || committing} onClick={submit}>
          Commit
        </Button>
      </div>
    </Modal>
  );
}
