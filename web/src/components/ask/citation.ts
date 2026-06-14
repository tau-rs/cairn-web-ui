import { stem } from "../../client/wikilink";

/** Like `stem`, but strips any file extension (not just `.md`). */
function anyStem(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

/** Resolve a citation target (a stem, possibly path-like) to a real note path
 *  by stem match, or null if none of `notePaths` matches. */
export function resolveStem(notePaths: string[], target: string): string | null {
  const t = stem(target);
  return notePaths.find((p) => anyStem(p) === t) ?? null;
}
