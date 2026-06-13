export type IconRef =
  | { kind: "emoji"; value: string }
  | { kind: "lucide"; name: string; color: string };

export interface TreeItemStyle {
  icon?: IconRef;
  folderColor?: string; // folders only; the left-bar accent
}

export type TreeStyleMap = Record<string, TreeItemStyle>;

const STORAGE_KEY = "cairn.treeIcons";

export function loadStyles(): TreeStyleMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const val = JSON.parse(raw) as unknown;
    if (!val || typeof val !== "object" || Array.isArray(val)) return {};
    return val as TreeStyleMap;
  } catch {
    return {};
  }
}

export function saveStyles(map: TreeStyleMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore (private mode / quota)
  }
}
