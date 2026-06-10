import type { Overrides } from "./commands";

const STORAGE_KEY = "cairn.keybindings";

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Overrides = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === null || typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveOverrides(o: Overrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    // ignore (private mode / quota)
  }
}
