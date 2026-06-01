export function SearchBar(props: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
}) {
  return (
    <input
      className="w-64 rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none"
      placeholder="Search…"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") props.onSearch(props.value);
      }}
    />
  );
}
