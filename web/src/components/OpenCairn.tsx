export function OpenCairn(props: { onOpen: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-neutral-900 text-neutral-100">
      <h1 className="text-lg font-semibold">Cairn</h1>
      <p className="text-sm text-neutral-400">No cairn open.</p>
      <button
        className="rounded border border-neutral-600 px-4 py-2 text-sm hover:bg-neutral-800"
        onClick={props.onOpen}
      >
        Open a cairn…
      </button>
    </div>
  );
}
