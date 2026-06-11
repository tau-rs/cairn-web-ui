import { createStore, type StoreApi } from "zustand/vanilla";
import { alwaysOpenHost, type CairnHost } from "../client/host";
import type { CairnClient, Unsubscribe } from "../client/types";
import type { ContractError, TagCount, Event } from "../contract";
import type { PluginSummary } from "../contract";
import { debounce, type Debounced } from "../util/timer";
import type { Overrides } from "../components/shortcuts/commands";
import {
  loadOverrides,
  saveOverrides,
} from "../components/shortcuts/keybindingPersistence";
import {
  openOrPreview,
  pinTab as pinTabModel,
  closeTab as closeTabModel,
  cycle as cycleModel,
  jumpTo as jumpToModel,
  type Tab,
  type TabsState,
} from "../components/tabs/tabsModel";
import { loadTabs, saveTabs } from "../components/tabs/tabsPersistence";
import type { SearchSnippet } from "../components/searchHighlight";
import type { Rename } from "../components/tree/treeMoves";

/** A queued, auto-dismissing error notification. */
export interface Toast {
  id: number;
  message: string;
}

/** How long a queued error toast stays before auto-dismissing (ms). */
export const ERROR_TOAST_MS = 6000;

export interface Settings {
  autosaveMs: number;
  idleAutoCommit: boolean;
  idleAutoCommitMs: number;
  intervalAutoCommit: boolean;
  intervalAutoCommitMin: number;
  editorMode: "livepreview" | "source";
  /** Auto-load remote (`http(s):`) and `data:` images in notes. Default off:
   *  a remote image is a tracking beacon that would otherwise fire on
   *  note-open. When off, such images render a click-to-load placeholder. */
  loadRemoteImages: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveMs: 1000,
  idleAutoCommit: true,
  idleAutoCommitMs: 5000,
  intervalAutoCommit: true,
  intervalAutoCommitMin: 5,
  editorMode: "livepreview",
  loadRemoteImages: false,
};

export interface NoteBuffer {
  contents: string;
  dirty: boolean;
  saving: boolean;
}

export interface UiState {
  settingsOpen: boolean;
  newNoteOpen: boolean;
  newNoteInitial: string;
  commitOpen: boolean;
  paletteOpen: boolean;
  /** Per-command keybinding overrides (chord, or null = unbound). Persisted. */
  keybindingOverrides: Overrides;
}

export const DEFAULT_UI: UiState = {
  settingsOpen: false,
  newNoteOpen: false,
  newNoteInitial: "",
  commitOpen: false,
  paletteOpen: false,
  keybindingOverrides: {},
};

export interface CairnState {
  cairnPath: string | null;
  // False until init()/openCairn() finishes restoring persisted tabs. RouteSync
  // waits for this so its URL<->store reconciliation can't race the restore.
  ready: boolean;
  notePaths: string[];
  openNotes: Record<string, NoteBuffer>;
  tabs: Tab[];
  activePath: string | null;
  activeContents: string;
  dirty: boolean;
  saving: boolean;
  uncommitted: boolean;
  lastCommit: string | null;
  committing: boolean;
  query: string;
  searchResults: string[] | null;
  searchSnippets: Record<string, SearchSnippet> | null;
  backlinks: string[];
  graph: { nodes: string[]; edges: { from: string; to: string }[] } | null;
  noteTags: Record<string, string[]>;
  tags: TagCount[];
  activeTag: string | null;
  plugins: PluginSummary[];
  notice: string | null;
  settings: Settings;
  ui: UiState;
  errors: Toast[];
  // Per-area pending flags so consumers can show a spinner/skeleton distinct
  // from an empty result. Set around each async call; a superseded request never
  // clears a newer one's flag (token-guarded).
  loading: {
    search: boolean;
    graph: boolean;
    backlinks: boolean;
    note: boolean;
  };
  // "down" when the push-event channel failed to attach — the reactive refresh
  // model is degraded and data may be stale until a manual refresh.
  liveUpdates: "ok" | "down";

  init(): Promise<void>;
  openCairn(): Promise<void>;
  refreshNotePaths(): Promise<void>;
  openNote(path: string): Promise<void>;
  editBuffer(contents: string): void;
  saveActive(): Promise<void>;
  saveNote(path: string): Promise<void>;
  createNote(path: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  applyRenames(ops: Rename[]): Promise<void>;
  selectTab(path: string): void;
  closeTab(path: string): void;
  closeActiveTab(): void;
  cycleTab(delta: 1 | -1): void;
  jumpToTab(n: number): void;
  pinTab(path: string): void;
  runSearch(query: string): Promise<void>;
  loadTags(): Promise<void>;
  filterByTag(tag: string): Promise<void>;
  loadPlugins(): Promise<void>;
  invokePlugin(plugin: string, command: string): Promise<void>;
  dismissNotice(): void;
  setQuery(query: string): void;
  closeSearch(): void;
  refreshBacklinks(): Promise<void>;
  loadGraph(): Promise<void>;
  commitManual(message: string): Promise<void>;
  autoCommit(): Promise<void>;
  rearmInterval(): void;
  setSettings(patch: Partial<Settings>): void;
  setUi(patch: Partial<UiState>): void;
  setKeybindingOverrides(overrides: Overrides): void;
  dismissError(id: number): void;
  refreshAll(): Promise<void>;
  assetUrl(relPath: string): string;
}

export function createCairnStore(
  client: CairnClient,
  host: CairnHost = alwaysOpenHost,
): StoreApi<CairnState> {
  const autosaves = new Map<string, Debounced>();
  let idleCommit: Debounced | null = null;
  let started = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let eventUnsub: Unsubscribe | null = null;

  // Monotonic request tokens: a slow response only applies if no newer request
  // of the same kind has started since. runSearch + filterByTag share `results`
  // because both write the search overlay, so the newest of either wins.
  const seq = { backlinks: 0, results: 0, graph: 0 };

  // Monotonic id for queued error toasts (auto-dismiss keys off it).
  let errorSeq = 0;

  // Paths the client itself just wrote, awaiting their note_changed echo. The
  // echo of our own write must not trigger the refresh cascade (autosave storm);
  // a per-path count tolerates several rapid self-writes to the same note.
  const pendingSelfWrites = new Map<string, number>();

  const store = createStore<CairnState>()((set, get) => {
    const tabsState = (): TabsState => ({
      tabs: get().tabs,
      activePath: get().activePath,
    });

    const persist = () => saveTabs(tabsState());

    // Write a note's buffer; if it's the active note, keep the top-level mirror
    // (activeContents/dirty/saving) in sync so existing consumers are unchanged.
    const setBuffer = (path: string, patch: Partial<NoteBuffer>) => {
      set((s) => {
        const cur = s.openNotes[path] ?? {
          contents: "",
          dirty: false,
          saving: false,
        };
        const buf = { ...cur, ...patch };
        const mirror =
          s.activePath === path
            ? {
                activeContents: buf.contents,
                dirty: buf.dirty,
                saving: buf.saving,
              }
            : {};
        return { openNotes: { ...s.openNotes, [path]: buf }, ...mirror };
      });
    };

    // Apply a new tabs/active selection and swap the active-note mirror.
    const applyTabs = (next: TabsState) => {
      const buf = next.activePath
        ? get().openNotes[next.activePath]
        : undefined;
      set({
        tabs: next.tabs,
        activePath: next.activePath,
        activeContents: buf?.contents ?? "",
        dirty: buf?.dirty ?? false,
        saving: buf?.saving ?? false,
      });
    };

    const setLoading = (key: keyof CairnState["loading"], value: boolean) =>
      set((s) => ({ loading: { ...s.loading, [key]: value } }));

    // Funnel for every caught command/query error. Logs a structured diagnostic
    // (operation + context + typed ContractError) for devs, surfaces an
    // operation-prefixed toast for users, and auto-dismisses it. Appends via a
    // functional set() so concurrent errors during a refresh storm queue up
    // instead of clobbering one another.
    const pushError = (
      operation: string,
      err: unknown,
      context: Record<string, unknown> = {},
    ) => {
      console.error(`[cairn] ${operation} failed`, {
        operation,
        ...context,
        error: err,
      });
      const id = ++errorSeq;
      const message = `${operation}: ${errMsg(err)}`;
      set((s) => ({ errors: [...s.errors, { id, message }] }));
      // Fire-and-forget: the store is a singleton for the page lifetime, so the
      // pending timer can't outlive a torn-down store. Manual dismiss is the
      // common case; this is just the auto-expiry backstop.
      setTimeout(() => {
        set((s) => ({ errors: s.errors.filter((t) => t.id !== id) }));
      }, ERROR_TOAST_MS);
    };

    // A query/command came back with a variant we don't handle. Narrowing on
    // `res.type` and silently no-opping would leave the view stale with no
    // diagnostic; route the surprise through the same error channel instead.
    const unexpected = (
      operation: string,
      res: { type: string },
      context: Record<string, unknown> = {},
    ) =>
      pushError(operation, new Error(`unexpected response: ${res.type}`), {
        ...context,
        response: res.type,
      });

    const dropNote = (path: string) => {
      autosaves.get(path)?.cancel();
      autosaves.delete(path);
      set((s) => {
        const rest = { ...s.openNotes };
        delete rest[path];
        return { openNotes: rest };
      });
    };

    // The push-event handler. Extracted so `connectEvents` can (re)attach it.
    const onEvent = (e: Event) => {
      if (e.type === "note_changed" || e.type === "note_deleted") {
        // Detect the echo of our own just-written note. A debounced autosave
        // must not fan the full index/graph cascade out on every keystroke
        // (the refresh storm) — but the *targeted* views that reflect the
        // edit just made (backlinks, the active search/filter) should still
        // update. So for a self-write we skip the expensive index-wide work
        // (note list, tags, and the whole-graph rebuild) and refresh only
        // the active note's derived data. External changes refresh fully.
        let selfWrite = false;
        if (e.type === "note_changed") {
          const pending = pendingSelfWrites.get(e.path) ?? 0;
          if (pending > 0) {
            if (pending === 1) pendingSelfWrites.delete(e.path);
            else pendingSelfWrites.set(e.path, pending - 1);
            selfWrite = true;
          }
        }
        if (!selfWrite) {
          void get().refreshNotePaths();
          void get().loadTags();
          if (get().graph !== null) void get().loadGraph();
        }
        const tag = get().activeTag;
        if (tag) void get().filterByTag(tag);
        else if (get().searchResults !== null)
          void get().runSearch(get().query);
        if (get().activePath) void get().refreshBacklinks();
      } else if (e.type === "committed") {
        set({ lastCommit: e.commit, uncommitted: false });
      }
    };

    // (Re)attach the event channel. A failed attach flips liveUpdates to "down"
    // so the UI can surface the degraded state and offer a manual refresh.
    const connectEvents = () => {
      eventUnsub?.();
      eventUnsub = client.subscribe(onEvent, () =>
        set({ liveUpdates: "down" }),
      );
    };

    // Load a cairn's derived state from scratch and arm autosave. Resets every
    // per-cairn view first (so nothing leaks from a previously-open cairn), then
    // reloads the note list, tags, plugins, and the persisted pinned tabs. Shared
    // by init() and openCairn() so the two load paths can't drift out of sync.
    const loadCairn = async () => {
      set({
        openNotes: {},
        tabs: [],
        activePath: null,
        activeContents: "",
        dirty: false,
        saving: false,
        backlinks: [],
        graph: null,
        noteTags: {},
        searchResults: null,
        searchSnippets: null,
        activeTag: null,
        tags: [],
        plugins: [],
        notice: null,
        loading: { search: false, graph: false, backlinks: false, note: false },
      });
      await get().refreshNotePaths();
      await get().loadTags();
      await get().loadPlugins();
      // Restore persisted pinned tabs; skip any that no longer load.
      const persisted = loadTabs(get().notePaths);
      for (const p of persisted.pinned) {
        try {
          await get().openNote(p);
          get().pinTab(p);
        } catch {
          /* skip a tab that won't load */
        }
      }
      if (persisted.activePath && get().openNotes[persisted.activePath]) {
        get().selectTab(persisted.activePath);
      }
      get().rearmInterval();
    };

    return {
      cairnPath: null,
      ready: false,
      notePaths: [],
      openNotes: {},
      tabs: [],
      activePath: null,
      activeContents: "",
      dirty: false,
      saving: false,
      uncommitted: false,
      lastCommit: null,
      committing: false,
      query: "",
      searchResults: null,
      searchSnippets: null,
      backlinks: [],
      graph: null,
      noteTags: {},
      tags: [],
      activeTag: null,
      plugins: [],
      notice: null,
      settings: DEFAULT_SETTINGS,
      ui: DEFAULT_UI,
      errors: [],
      loading: { search: false, graph: false, backlinks: false, note: false },
      liveUpdates: "ok",

      async init() {
        if (started) return;
        started = true;
        set((s) => ({
          ui: { ...s.ui, keybindingOverrides: loadOverrides() },
        }));
        const path = await host.currentCairn();
        set({ cairnPath: path });
        // Attach the push-event channel once, for the store's lifetime — NOT
        // inside the path gate.
        connectEvents();
        if (path !== null) {
          await loadCairn();
        }
        // Restore is complete: RouteSync may now reconcile URL <-> store. Setting
        // this last means a /note/* deep link in the URL is opened by RouteSync
        // *after* (and so wins over) the persisted-tab restore above, without the
        // two racing during startup.
        set({ ready: true });
      },

      async openCairn() {
        try {
          const path = await host.openCairn();
          if (path === null) return; // cancelled
          set({ cairnPath: path });
          await loadCairn();
          // The freshly loaded cairn is restored; RouteSync gates on this — flip
          // it so URL <-> store reconciliation can run.
          set({ ready: true });
        } catch (err) {
          pushError("Open vault", err);
        }
      },

      async refreshNotePaths() {
        try {
          const res = await client.runQuery({ type: "list_notes" });
          if (res.type === "notes")
            set({ notePaths: res.notes.map((n) => n.path) });
          else unexpected("List notes", res);
        } catch (err) {
          pushError("List notes", err);
        }
      },

      async openNote(path) {
        try {
          if (!get().openNotes[path]) {
            setLoading("note", true);
            try {
              const res = await client.runQuery({ type: "get_note", path });
              if (res.type !== "note") {
                unexpected("Open note", res, { path });
                return;
              }
              set((s) => ({
                openNotes: {
                  ...s.openNotes,
                  [path]: {
                    contents: res.contents,
                    dirty: false,
                    saving: false,
                  },
                },
              }));
            } finally {
              setLoading("note", false);
            }
          }
          applyTabs(openOrPreview(tabsState(), path));
          persist();
          await get().refreshBacklinks();
        } catch (err) {
          pushError("Open note", err, { path });
        }
      },

      editBuffer(contents) {
        const path = get().activePath;
        if (!path) return;
        setBuffer(path, { contents, dirty: true });
        // Editing pins the (possibly preview) active tab.
        applyTabs(pinTabModel(tabsState(), path));
        persist();
        // One persistent debounce per open note, re-triggered on each keystroke
        // rather than reconstructed — the delay thunk re-reads autosaveMs so a
        // settings change still applies on the next edit.
        let d = autosaves.get(path);
        if (!d) {
          d = debounce(
            () => void get().saveNote(path),
            () => get().settings.autosaveMs,
          );
          autosaves.set(path, d);
        }
        d();
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

      saveActive() {
        return get().saveNote(get().activePath ?? "");
      },

      async saveNote(path) {
        const buf = get().openNotes[path];
        if (!buf || !buf.dirty) return;
        const snapshot = buf.contents;
        setBuffer(path, { saving: true });
        // Mark before sending: the engine echoes note_changed for this write and
        // the subscribe handler must see the pending mark to suppress it.
        pendingSelfWrites.set(path, (pendingSelfWrites.get(path) ?? 0) + 1);
        try {
          await client.sendCommand({
            type: "write_note",
            path,
            contents: snapshot,
          });
          const cur = get().openNotes[path];
          // If the note was closed mid-write its buffer is gone — don't resurrect
          // it; the write still landed, so just mark the repo uncommitted.
          if (cur) {
            setBuffer(path, {
              saving: false,
              // Stay dirty if the note changed during the write (the pending
              // debounce will save it).
              dirty: cur.contents !== snapshot,
            });
          }
          set({ uncommitted: true });
        } catch (err) {
          // The write failed, so no echo is coming — release the pending mark
          // (else a later external change to this path would be wrongly skipped).
          pendingSelfWrites.set(
            path,
            Math.max(0, (pendingSelfWrites.get(path) ?? 1) - 1),
          );
          if (get().openNotes[path]) setBuffer(path, { saving: false });
          pushError("Save note", err, { path });
        }
      },

      async createNote(path) {
        try {
          await client.sendCommand({ type: "write_note", path, contents: "" });
          await get().openNote(path);
          get().pinTab(path); // new notes open pinned
        } catch (err) {
          pushError("Create note", err, { path });
        }
      },

      async deleteNote(path) {
        try {
          await client.sendCommand({ type: "delete_note", path });
          get().closeTab(path);
        } catch (err) {
          pushError("Delete note", err, { path });
        }
      },

      async applyRenames(ops) {
        for (const { from, to } of ops) {
          try {
            await client.sendCommand({ type: "rename_note", from, to });
          } catch (err) {
            pushError("Rename note", err, { from, to });
            break;
          }
          set((s) => {
            const openNotes = { ...s.openNotes };
            if (from in openNotes) {
              openNotes[to] = openNotes[from];
              delete openNotes[from];
            }
            return {
              openNotes,
              tabs: s.tabs.map((t) =>
                t.path === from ? { ...t, path: to } : t,
              ),
              activePath: s.activePath === from ? to : s.activePath,
            };
          });
        }
        persist();
        if (get().activePath) void get().refreshBacklinks();
      },

      selectTab(path) {
        if (!get().openNotes[path]) return;
        applyTabs({ tabs: get().tabs, activePath: path });
        persist();
        void get().refreshBacklinks();
      },

      closeTab(path) {
        // Flush any pending edit before the buffer is dropped (saveNote snapshots
        // contents synchronously and is a no-op when not dirty).
        void get().saveNote(path);
        dropNote(path);
        applyTabs(closeTabModel(tabsState(), path));
        persist();
        void get().refreshBacklinks();
      },

      closeActiveTab() {
        const path = get().activePath;
        if (path) get().closeTab(path);
      },

      cycleTab(delta) {
        applyTabs(cycleModel(tabsState(), delta));
        persist();
        void get().refreshBacklinks();
      },

      jumpToTab(n) {
        applyTabs(jumpToModel(tabsState(), n));
        persist();
        void get().refreshBacklinks();
      },

      pinTab(path) {
        if (!get().openNotes[path]) return; // only pin an actually-open note
        // Pinning focuses the tab too (used by double-click and createNote).
        applyTabs(pinTabModel({ tabs: get().tabs, activePath: path }, path));
        persist();
        void get().refreshBacklinks();
      },

      async runSearch(query) {
        const token = ++seq.results;
        setLoading("search", true);
        try {
          const res = await client.runQuery({ type: "search", query });
          if (token !== seq.results) return; // a newer search/filter superseded
          if (res.type === "search_results") {
            set({
              query,
              searchResults: res.results.map((r) => r.path),
              searchSnippets: Object.fromEntries(
                res.results.map((r) => [
                  r.path,
                  { snippet: r.snippet, highlights: r.highlights },
                ]),
              ),
              activeTag: null,
            });
          } else unexpected("Search", res, { query });
        } catch (err) {
          if (token !== seq.results) return;
          pushError("Search", err, { query });
        } finally {
          // Only the current request clears the flag; a superseded one leaves it
          // set because the newer request that bumped the token now owns it.
          if (token === seq.results) setLoading("search", false);
        }
      },

      async loadTags() {
        try {
          const res = await client.runQuery({ type: "list_tags" });
          if (res.type === "tags") set({ tags: res.tags });
          else unexpected("Load tags", res);
        } catch (err) {
          pushError("Load tags", err);
        }
      },

      async filterByTag(tag) {
        const token = ++seq.results;
        setLoading("search", true);
        try {
          const res = await client.runQuery({ type: "notes_by_tag", tag });
          if (token !== seq.results) return; // a newer search/filter superseded
          if (res.type === "paths")
            set({
              searchResults: res.paths,
              searchSnippets: null,
              activeTag: tag,
            });
          else unexpected("Filter notes by tag", res, { tag });
        } catch (err) {
          if (token !== seq.results) return;
          pushError("Filter notes by tag", err, { tag });
        } finally {
          if (token === seq.results) setLoading("search", false);
        }
      },

      async loadPlugins() {
        try {
          const res = await client.runQuery({ type: "list_plugins" });
          if (res.type === "plugins") set({ plugins: res.plugins });
          else unexpected("Load plugins", res);
        } catch (err) {
          pushError("Load plugins", err);
        }
      },

      async invokePlugin(plugin, command) {
        try {
          const res = await client.sendCommand({
            type: "invoke_plugin_command",
            plugin,
            command,
            args: null,
          });
          if (res.type === "plugin_result") {
            set({
              notice:
                typeof res.result === "string" ? res.result : `Ran ${command}`,
            });
          } else unexpected("Run plugin command", res, { plugin, command });
        } catch (err) {
          pushError("Run plugin command", err, { plugin, command });
        }
      },

      dismissNotice() {
        set({ notice: null });
      },

      setQuery(query) {
        set({ query });
      },

      closeSearch() {
        set({ searchResults: null, searchSnippets: null, activeTag: null });
      },

      async refreshBacklinks() {
        const path = get().activePath;
        if (!path) {
          setLoading("backlinks", false);
          return set({ backlinks: [] });
        }
        const token = ++seq.backlinks;
        setLoading("backlinks", true);
        try {
          const res = await client.runQuery({ type: "get_backlinks", path });
          if (token !== seq.backlinks) return; // superseded by a newer request
          if (res.type === "paths") set({ backlinks: res.paths });
          else unexpected("Load backlinks", res, { path });
        } catch (err) {
          if (token !== seq.backlinks) return;
          pushError("Load backlinks", err, { path });
        } finally {
          if (token === seq.backlinks) setLoading("backlinks", false);
        }
      },

      async loadGraph() {
        const token = ++seq.graph;
        setLoading("graph", true);
        try {
          try {
            const res = await client.runQuery({ type: "get_graph" });
            if (token !== seq.graph) return; // superseded by a newer reload
            if (res.type === "graph")
              set({ graph: { nodes: res.nodes, edges: res.edges } });
            else unexpected("Load graph", res);
          } catch (err) {
            if (token !== seq.graph) return;
            pushError("Load graph", err);
          }
          try {
            const tags = await client.noteTags();
            if (token !== seq.graph) return; // superseded by a newer reload
            set({ noteTags: tags });
          } catch {
            // leave the existing noteTags as-is — stale data beats clearing it
          }
        } finally {
          if (token === seq.graph) setLoading("graph", false);
        }
      },

      async commitManual(message) {
        if (get().committing) return;
        set({ committing: true });
        try {
          const res = await client.sendCommand({ type: "commit", message });
          if (res.type === "committed")
            set({ lastCommit: res.commit, uncommitted: false });
          else unexpected("Commit", res);
        } catch (err) {
          pushError("Commit", err);
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

      setUi(patch) {
        set((s) => ({ ui: { ...s.ui, ...patch } }));
      },

      setKeybindingOverrides(overrides) {
        saveOverrides(overrides);
        set((s) => ({ ui: { ...s.ui, keybindingOverrides: overrides } }));
      },

      dismissError(id) {
        set((s) => ({ errors: s.errors.filter((t) => t.id !== id) }));
      },

      async refreshAll() {
        // The manual-refresh affordance: re-attach the channel (in case it
        // dropped) and re-pull everything the push events would have. Clearing
        // the flag is optimistic — if re-attach fails again, connectEvents'
        // onError flips it back to "down".
        connectEvents();
        set({ liveUpdates: "ok" });
        await get().refreshNotePaths();
        await get().loadTags();
        if (get().graph !== null) await get().loadGraph();
        // Reconcile the active overlay too, mirroring the push handler — else a
        // refresh while filtered/searching leaves a stale results list.
        const tag = get().activeTag;
        if (tag) await get().filterByTag(tag);
        else if (get().searchResults !== null)
          await get().runSearch(get().query);
        if (get().activePath) await get().refreshBacklinks();
      },

      assetUrl(relPath: string) {
        return host.assetUrl(relPath);
      },
    };
  });

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
