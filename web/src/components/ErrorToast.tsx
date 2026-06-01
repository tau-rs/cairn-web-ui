export function ErrorToast(props: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (props.message === null) return null;
  return (
    <div className="fixed bottom-4 right-4 z-20 flex items-center gap-3 rounded border border-red-700 bg-red-950 px-3 py-2 text-sm text-red-200 shadow-lg">
      <span>{props.message}</span>
      <button
        className="text-red-300 hover:text-white"
        aria-label="dismiss"
        onClick={props.onDismiss}
      >
        ✕
      </button>
    </div>
  );
}
