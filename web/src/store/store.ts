import { createStore, type StoreApi } from "zustand/vanilla";
import { alwaysOpenHost, type CairnHost } from "../client/host";
import type { CairnClient } from "../client/types";
import type { ContractError } from "../contract";
import { debounce, type Debounced } from "../util/timer";

export interface Settings {
  autosaveMs: number;
  idleAutoCommit: boolean;
  idleAutoCommitMs: number;
  intervalAutoCommit: boolean;
  intervalAutoCommitMin: number;
  editorMode: "rendered" | "source";
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveMs: 1000,
  idleAutoCommit: true,
  idleAutoCommitMs: 5000,
  intervalAutoCommit: true,
  intervalAutoCommitMin: 5,
  editorMode: "rendered",
};

export interface CairnState {
  cairnPath: string | null;
  notePaths: string[];
  activePath: string | null;
  activeContents: string;
  dirty: boolean;
  saving: boolean;
  uncommitted: boolean;
  lastCommit: string | null;
  committing: boolean;
  query: string;
  searchResults: string[] | null;
  backlinks: string[];
  graph: { nodes: string[]; edges: { from: string; to: string }[] } | null;
  settings: Settings;
  error: string | null;

  init(): Promise<void>;
  openCairn(): Promise<void>;
  refreshNotePaths(): Promise<void>;
  openNote(path: string): Promise<void>;
  editBuffer(contents: string): void;
  saveActive(): Promise<void>;
  createNote(path: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  runSearch(query: string): Promise<void>;
  setQuery(query: string): void;
  closeSearch(): void;
  refreshBacklinks(): Promise<void>;
  loadGraph(): Promise<void>;
  commitManual(message: string): Promise<void>;
  autoCommit(): Promise<void>;
  rearmInterval(): void;
  setSettings(patch: Partial<Settings>): void;
  dismissError(): void;
}

export function createCairnStore(
  client: CairnClient,
  host: CairnHost = alwaysOpenHost,
): StoreApi<CairnState> {
  let autosave: Debounced | null = null;
  let idleCommit: Debounced | null = null;
  let started = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const store = createStore<CairnState>()((set, get) => ({
    cairnPath: null,
    notePaths: [],
    activePath: null,
    activeContents: "",
    dirty: false,
    saving: false,
    uncommitted: false,
    lastCommit: null,
    committing: false,
    query: "",
    searchResults: null,
    backlinks: [],
    graph: null,
    settings: DEFAULT_SETTINGS,
    error: null,

    async init() {
      if (started) return;
      started = true;
      const path = await host.currentCairn();
      set({ cairnPath: path });
      // Subscribe once, for the store's lifetime — NOT inside the `path !== null`
      // gate below. The event channel is global (not per-cairn), and openCairn()
      // relies on this subscription already being live. Don't move it.
      client.subscribe((e) => {
        if (e.type === "note_changed" || e.type === "note_deleted") {
          void get().refreshNotePaths();
          if (get().searchResults !== null) void get().runSearch(get().query);
          if (get().activePath) void get().refreshBacklinks();
          if (get().graph !== null) void get().loadGraph();
        } else if (e.type === "committed") {
          set({ lastCommit: e.commit, uncommitted: false });
        }
      });
      if (path !== null) {
        await get().refreshNotePaths();
        get().rearmInterval();
      }
    },

    async openCairn() {
      try {
        const path = await host.openCairn();
        if (path === null) return; // cancelled
        set({
          cairnPath: path,
          activePath: null,
          activeContents: "",
          backlinks: [],
        });
        await get().refreshNotePaths();
        get().rearmInterval();
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    async refreshNotePaths() {
      try {
        const res = await client.runQuery({ type: "list_notes" });
        if (res.type === "notes")
          set({ notePaths: res.notes.map((n) => n.path) });
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    async openNote(path) {
      try {
        const res = await client.runQuery({ type: "get_note", path });
        if (res.type === "note") {
          set({ activePath: path, activeContents: res.contents, dirty: false });
          await get().refreshBacklinks();
        }
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    editBuffer(contents) {
      set({ activeContents: contents, dirty: true });
      autosave?.cancel();
      autosave = debounce(
        () => void get().saveActive(),
        get().settings.autosaveMs,
      );
      autosave();
      const s = get().settings;
      if (s.idleAutoCommit) {
        idleCommit?.cancel();
        idleCommit = debounce(
          () => void get().autoCommit(),
          s.idleAutoCommitMs,
        );
        idleCommit();
      }
    },

    async saveActive() {
      const path = get().activePath;
      if (!path || !get().dirty) return;
      const snapshot = get().activeContents;
      set({ saving: true });
      try {
        await client.sendCommand({
          type: "write_note",
          path,
          contents: snapshot,
        });
        set((s) => ({
          saving: false,
          uncommitted: true,
          // Stay dirty if the note changed during the write (the pending debounce
          // will save it); don't touch dirty if the user navigated to another note.
          dirty:
            s.activePath === path ? s.activeContents !== snapshot : s.dirty,
        }));
      } catch (err) {
        set({ saving: false, error: errMsg(err) });
      }
    },

    async createNote(path) {
      try {
        await client.sendCommand({ type: "write_note", path, contents: "" });
        await get().openNote(path);
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    async deleteNote(path) {
      try {
        await client.sendCommand({ type: "delete_note", path });
        if (get().activePath === path)
          set({
            activePath: null,
            activeContents: "",
            backlinks: [],
            dirty: false,
            saving: false,
          });
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    async runSearch(query) {
      try {
        const res = await client.runQuery({ type: "search", query });
        if (res.type === "paths") set({ query, searchResults: res.paths });
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    setQuery(query) {
      set({ query });
    },

    closeSearch() {
      set({ searchResults: null });
    },

    async refreshBacklinks() {
      const path = get().activePath;
      if (!path) return set({ backlinks: [] });
      try {
        const res = await client.runQuery({ type: "get_backlinks", path });
        if (res.type === "paths") set({ backlinks: res.paths });
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    async loadGraph() {
      try {
        const res = await client.runQuery({ type: "get_graph" });
        if (res.type === "graph") set({ graph: { nodes: res.nodes, edges: res.edges } });
      } catch (err) {
        set({ error: errMsg(err) });
      }
    },

    async commitManual(message) {
      if (get().committing) return;
      set({ committing: true });
      try {
        const res = await client.sendCommand({ type: "commit", message });
        if (res.type === "committed")
          set({ lastCommit: res.commit, uncommitted: false });
      } catch (err) {
        set({ error: errMsg(err) });
      } finally {
        set({ committing: false });
      }
    },

    async autoCommit() {
      if (!get().uncommitted || get().committing) return;
      const path = get().activePath;
      const message = path ? `cairn: update ${path}` : "cairn: auto-commit";
      await get().commitManual(message);
    },

    rearmInterval() {
      if (intervalHandle) clearInterval(intervalHandle);
      intervalHandle = null;
      const { intervalAutoCommit, intervalAutoCommitMin } = get().settings;
      if (intervalAutoCommit) {
        intervalHandle = setInterval(
          () => void get().autoCommit(),
          intervalAutoCommitMin * 60_000,
        );
      }
    },

    setSettings(patch) {
      set({ settings: { ...get().settings, ...patch } });
      if ("intervalAutoCommit" in patch || "intervalAutoCommitMin" in patch) {
        get().rearmInterval();
      }
    },

    dismissError() {
      set({ error: null });
    },
  }));

  return store;
}

function errMsg(err: unknown): string {
  // ContractError (rejected by the client) is a tagged object.
  if (err && typeof err === "object" && "type" in err) {
    const e = err as ContractError;
    if (e.type === "not_found") return `Not found: ${e.what}`;
    return e.message;
  }
  return err instanceof Error ? err.message : String(err);
}
