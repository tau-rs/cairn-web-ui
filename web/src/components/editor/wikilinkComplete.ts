/** Fire rule: an open `[[` with a partial containing no `]` or `|`, anchored at
 *  the cursor. The single regex rejects the no-`[[`, already-closed, and
 *  alias-part cases. Returns the filtered+deduped stems and the offset (within
 *  `textBefore`) where the partial starts, or null when it should not fire. */
export function wikilinkCompletionState(
  textBefore: string,
  stems: string[],
): { from: number; stems: string[] } | null {
  const m = /\[\[([^\]|]*)$/.exec(textBefore);
  if (!m) return null;
  const partial = m[1];
  const from = m.index + 2; // position right after the `[[`
  const seen = new Set<string>();
  const deduped = stems.filter((s) => (seen.has(s) ? false : seen.add(s)));
  const needle = partial.toLowerCase();
  const filtered = needle
    ? deduped.filter((s) => s.toLowerCase().includes(needle))
    : deduped;
  return { from, stems: filtered };
}

/** The text to insert when a completion is applied: the stem, plus a closing
 *  `]]` unless the text right after the cursor already starts with `]]`. */
export function wikilinkInsert(stem: string, textAfter: string): string {
  return textAfter.startsWith("]]") ? stem : stem + "]]";
}
