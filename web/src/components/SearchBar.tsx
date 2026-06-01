import { useRef } from "react";

export function SearchBar(props: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={inputRef}
      className="w-64 rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none"
      placeholder="Search…"
      defaultValue={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && inputRef.current) {
          props.onSearch(inputRef.current.value);
        }
      }}
    />
  );
}
