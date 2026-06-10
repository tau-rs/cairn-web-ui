import type { TabsState } from "./tabsModel";

export interface PersistedTabs {
  pinned: string[];
  activePath: string | null;
}

const STORAGE_KEY = "cairn.tabs";

/** Persist only the pinned tabs (paths) + the active path. */
export function saveTabs(state: TabsState): void {
  try {
    const data: PersistedTabs = {
      pinned: state.tabs.filter((t) => !t.preview).map((t) => t.path),
      activePath: state.activePath,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore (private mode / quota)
  }
}

/** Load pinned tabs, dropping any path not in `existingPaths`. The restored
 *  active path is always one of the surviving pinned tabs (else the last, else null). */
export function loadTabs(existingPaths: string[]): PersistedTabs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { pinned: [], activePath: null };
    const parsed = JSON.parse(raw) as Partial<PersistedTabs>;
    const exists = new Set(existingPaths);
    const pinned = (parsed.pinned ?? []).filter((p) => exists.has(p));
    const activePath =
      parsed.activePath && pinned.includes(parsed.activePath)
        ? parsed.activePath
        : pinned.length > 0
          ? pinned[pinned.length - 1]
          : null;
    return { pinned, activePath };
  } catch {
    return { pinned: [], activePath: null };
  }
}
