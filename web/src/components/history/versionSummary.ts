import type { RevisionEx } from "../../client/contractExt";

// Matches the engine's deterministic label template "(+N/−M words)".
// Accepts U+2212 minus (the template) and ASCII hyphen (defensive).
const DELTA_RE = /\(\+(\d+)\/[−-](\d+) words\)/;

export function versionWordDelta(
  r: RevisionEx,
): { added: number; removed: number } | null {
  if (typeof r.words_added === "number" && typeof r.words_removed === "number")
    return { added: r.words_added, removed: r.words_removed };
  const m = DELTA_RE.exec(r.message);
  return m ? { added: Number(m[1]), removed: Number(m[2]) } : null;
}
