export interface Debounced {
  (): void;
  cancel(): void;
}

/** Debounce a zero-arg function: invoke `fn` `ms` after the last call. */
export function debounce(fn: () => void, ms: number): Debounced {
  let handle: ReturnType<typeof setTimeout> | null = null;
  const d = (() => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn();
    }, ms);
  }) as Debounced;
  d.cancel = () => {
    if (handle) clearTimeout(handle);
    handle = null;
  };
  return d;
}
