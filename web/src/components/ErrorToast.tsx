import { IconButton } from "./ui/IconButton";

export function ErrorToast(props: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (props.message === null) return null;
  return (
    <div className="fixed bottom-4 right-4 z-20 flex items-center gap-3 rounded border border-danger bg-danger-bg px-3 py-2 text-sm text-danger shadow-lg">
      <span>{props.message}</span>
      <IconButton label="dismiss" onClick={props.onDismiss}>
        ✕
      </IconButton>
    </div>
  );
}
