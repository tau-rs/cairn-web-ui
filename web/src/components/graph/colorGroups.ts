export interface ColorGroup {
  kind: "path" | "tag";
  query: string;
  color: string;
}

const STORAGE_KEY = "cairn.graph.groups";

const isValid = (g: unknown): g is ColorGroup =>
  typeof g === "object" &&
  g !== null &&
  ((g as ColorGroup).kind === "path" || (g as ColorGroup).kind === "tag") &&
  typeof (g as ColorGroup).query === "string" &&
  typeof (g as ColorGroup).color === "string";

export function loadColorGroups(): ColorGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid);
  } catch {
    return [];
  }
}

export function saveColorGroups(groups: ColorGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // ignore (private mode / quota)
  }
}

/** First group that matches the node → its color; else null.
 *  path: case-insensitive substring of the path. tag: exact (case-insensitive)
 *  membership in the note's tags (tags are already lowercased by extractTags). */
export function matchGroupColor(
  path: string,
  tags: string[],
  groups: ColorGroup[],
): string | null {
  const lowerPath = path.toLowerCase();
  for (const g of groups) {
    const q = g.query.trim().toLowerCase();
    if (!q) continue;
    if (g.kind === "path" ? lowerPath.includes(q) : tags.includes(q)) {
      return g.color;
    }
  }
  return null;
}
