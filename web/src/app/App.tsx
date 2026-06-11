import { useEffect, useState, useRef, useMemo } from "react";
import { GraphView } from "../components/GraphView";
import { Shell } from "../components/Shell";
import { FolderTree } from "../components/tree/FolderTreeView";
import { TagsPanel } from "../components/tags/TagsPanel";
import { Editor } from "../components/Editor";
import { TabStrip } from "../components/tabs/TabStrip";
import { Backlinks } from "../components/Backlinks";
import { SearchBar } from "../components/SearchBar";
import { SearchResults } from "../components/SearchResults";
import { CommitBar } from "../components/CommitBar";
import { ErrorToast } from "../components/ErrorToast";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { NoticeToast } from "../components/NoticeToast";
import {
  toPaletteCommands,
  parsePluginCommandId,
} from "../components/plugins/pluginCommands";
import { IconButton } from "../components/ui/IconButton";
import { SettingsDialog } from "../components/SettingsDialog";
import { NewNoteDialog } from "../components/NewNoteDialog";
import { CommitDialog } from "../components/CommitDialog";
import {
  CommandPalette,
  type PaletteCommand,
} from "../components/command-palette/CommandPalette";
import { OpenCairn } from "../components/OpenCairn";
import { useLocation, useNavigate } from "react-router-dom";
import { RouteSync } from "./RouteSync";
import { noteUrl, tagUrl, tagFromLocation, isGraph } from "./routes";
import { cairnStore, useCairn } from "./cairnStore";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import {
  COMMAND_DEFS,
  effectiveBinding,
  chordToId,
  type Overrides,
} from "../components/shortcuts/commands";
import { eventToChord, formatChord } from "../components/shortcuts/keybinding";
import {
  loadOverrides,
  saveOverrides,
} from "../components/shortcuts/keybindingPersistence";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /mac/i.test(navigator.platform || navigator.userAgent || "");

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const chordMap = useMemo(() => chordToId(overrides), [overrides]);
  const runCommandRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const chord = eventToChord(e);
      const id = chord ? chordMap[chord] : undefined;
      if (id) {
        e.preventDefault();
        runCommandRef.current(id);
        return;
      }
      // Built-in tab navigation (parameterized; not rebindable).
      const st = cairnStore.getState();
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        st.cycleTab(e.shiftKey ? -1 : 1);
      } else if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        st.jumpToTab(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chordMap]);

  const notePaths = useCairn((s) => s.notePaths);
  const activePath = useCairn((s) => s.activePath);
  const activeContents = useCairn((s) => s.activeContents);
  const editorMode = useCairn((s) => s.settings.editorMode);
  const loadRemoteImages = useCairn((s) => s.settings.loadRemoteImages);
  const settings = useCairn((s) => s.settings);
  const backlinks = useCairn((s) => s.backlinks);
  const query = useCairn((s) => s.query);
  const searchResults = useCairn((s) => s.searchResults);
  const searchSnippets = useCairn((s) => s.searchSnippets);
  const saving = useCairn((s) => s.saving);
  const dirty = useCairn((s) => s.dirty);
  const uncommitted = useCairn((s) => s.uncommitted);
  const lastCommit = useCairn((s) => s.lastCommit);
  const committing = useCairn((s) => s.committing);
  const cairnPath = useCairn((s) => s.cairnPath);
  const error = useCairn((s) => s.error);
  const graph = useCairn((s) => s.graph);
  const noteTags = useCairn((s) => s.noteTags);
  const tabs = useCairn((s) => s.tabs);
  const openNotes = useCairn((s) => s.openNotes);
  const tags = useCairn((s) => s.tags);
  const activeTag = useCairn((s) => s.activeTag);
  const plugins = useCairn((s) => s.plugins);
  const notice = useCairn((s) => s.notice);
  const loading = useCairn((s) => s.loading);
  const view = isGraph(location) ? "graph" : "editor";
  // Where the Graph/Editor toggle should navigate: into the graph, or back to
  // the active note (root if none). Used by both the command and the top-bar button.
  const toggleViewTarget = () =>
    isGraph(location) ? (activePath ? noteUrl(activePath) : "/") : "/graph";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteInitial, setNewNoteInitial] = useState("");
  const [commitOpen, setCommitOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Store action functions are stable for the store's lifetime (Zustand never
  // replaces them; they read fresh state via get()), so capturing them once is safe.
  const actions = cairnStore.getState();

  if (cairnPath === null) {
    return <OpenCairn onOpen={() => void actions.openCairn()} />;
  }

  const COMMANDS: PaletteCommand[] = [
    ...COMMAND_DEFS.filter((d) => d.id !== "open-palette").map((d) => {
      const eff = effectiveBinding(d.id, overrides);
      return {
        id: d.id,
        label: d.label,
        hint: eff ? formatChord(eff, IS_MAC) : undefined,
      };
    }),
    ...toPaletteCommands(plugins),
  ];
  const runCommand = (id: string) => {
    const pluginCmd = parsePluginCommandId(id);
    if (pluginCmd) {
      void actions.invokePlugin(pluginCmd.plugin, pluginCmd.command);
      setPaletteOpen(false);
      return;
    }
    switch (id) {
      case "open-palette":
        setPaletteOpen((o) => !o);
        return;
      case "new-note":
        setNewNoteInitial("");
        setNewNoteOpen(true);
        break;
      case "commit":
        setCommitOpen(true);
        break;
      case "close-tab":
        actions.closeActiveTab();
        break;
      case "toggle-view":
        navigate(toggleViewTarget());
        break;
      case "open-settings":
        setSettingsOpen(true);
        break;
      case "toggle-editor-mode":
        actions.setSettings({
          editorMode: editorMode === "livepreview" ? "source" : "livepreview",
        });
        break;
      case "nav-back":
        navigate(-1);
        break;
      case "nav-forward":
        navigate(1);
        break;
    }
    setPaletteOpen(false);
  };
  runCommandRef.current = runCommand;

  const tabViews = tabs.map((t) => ({
    path: t.path,
    preview: t.preview,
    dirty: openNotes[t.path]?.dirty ?? false,
  }));

  return (
    <>
      <RouteSync />
      <Shell
        topBar={
          <div className="flex w-full items-center gap-3">
            <Logo />
            <span className="text-sm font-semibold text-text">Cairn</span>
            <SearchBar
              value={query}
              onChange={actions.setQuery}
              onSearch={actions.runSearch}
            />
            <Button
              variant="ghost"
              onClick={() => navigate(toggleViewTarget())}
            >
              {view === "graph" ? "Editor" : "Graph"}
            </Button>
            <span className="grow" />
            <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </IconButton>
            <CommitBar
              saving={saving}
              dirty={dirty}
              uncommitted={uncommitted}
              lastCommit={lastCommit}
              committing={committing}
              onRequestCommit={() => setCommitOpen(true)}
            />
          </div>
        }
        list={
          <>
            <FolderTree
              paths={notePaths}
              activePath={activePath}
              onOpen={(p) => navigate(noteUrl(p))}
              onDelete={actions.deleteNote}
              onRequestNew={() => {
                setNewNoteInitial("");
                setNewNoteOpen(true);
              }}
              onRequestNewInFolder={(folder) => {
                setNewNoteInitial(folder + "/");
                setNewNoteOpen(true);
              }}
              onApplyRenames={actions.applyRenames}
            />
            <TagsPanel
              tags={tags}
              activeTag={activeTag}
              onSelect={(t) => navigate(tagUrl(t))}
            />
          </>
        }
        editor={
          // Retry clears the boundary so the pane re-renders; it recovers from
          // transient throws. If the cause is intrinsic to the open note (e.g. a
          // decoration-builder bug on its content), the crash recurs until the
          // user navigates away — still better than blanking the whole app.
          <ErrorBoundary
            fallback={(reset) => (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-text"
              >
                <p className="text-sm font-medium">This view crashed.</p>
                <p className="max-w-sm text-xs text-muted">
                  The rest of the app is still usable. Retry to reload just this
                  pane.
                </p>
                <Button variant="primary" onClick={reset}>
                  Retry
                </Button>
              </div>
            )}
          >
            <div className="relative h-full">
              <SearchResults
                results={searchResults}
                loading={loading.search}
                snippets={searchSnippets ?? undefined}
                title={activeTag ? `Tagged · ${activeTag}` : undefined}
                onOpen={(p) => navigate(noteUrl(p))}
                onClose={() => {
                  // A tag filter is URL-owned (we're on /tags/:tag), so dismiss it
                  // by navigating away; RouteSync then clears the overlay. A plain
                  // text search is a store-only overlay with no route, so close it
                  // in the store directly.
                  if (tagFromLocation(location) !== null) {
                    navigate(activePath ? noteUrl(activePath) : "/");
                  } else {
                    actions.closeSearch();
                  }
                }}
              />
              {view === "graph" ? (
                <GraphView
                  nodes={graph?.nodes ?? []}
                  edges={graph?.edges ?? []}
                  tagsByNote={noteTags}
                  activePath={activePath}
                  loading={loading.graph}
                  onOpenNote={(p) => navigate(noteUrl(p))}
                />
              ) : (
                <div className="flex h-full flex-col">
                  <TabStrip
                    tabs={tabViews}
                    activePath={activePath}
                    onSelect={(p) => navigate(noteUrl(p))}
                    onPin={actions.pinTab}
                    onClose={actions.closeTab}
                  />
                  <div className="relative min-h-0 flex-1">
                    {loading.note && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/50">
                        <Spinner label="Loading note" />
                      </div>
                    )}
                    <Editor
                      path={activePath}
                      value={activeContents}
                      mode={editorMode}
                      notePaths={notePaths}
                      assetUrl={actions.assetUrl}
                      loadRemoteImages={loadRemoteImages}
                      onChange={actions.editBuffer}
                      onOpenNote={(p) => navigate(noteUrl(p))}
                      onToggleMode={() =>
                        actions.setSettings({
                          editorMode:
                            editorMode === "livepreview"
                              ? "source"
                              : "livepreview",
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>
        }
        backlinks={
          <Backlinks
            paths={backlinks}
            loading={loading.backlinks}
            onOpen={(p) => navigate(noteUrl(p))}
          />
        }
      />
      <ErrorToast message={error} onDismiss={actions.dismissError} />
      <NoticeToast message={notice} onDismiss={actions.dismissNotice} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={actions.setSettings}
        keybindingOverrides={overrides}
        onKeybindingsChange={(o) => {
          setOverrides(o);
          saveOverrides(o);
        }}
        plugins={plugins}
      />
      <NewNoteDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        initialPath={newNoteInitial}
        onCreate={actions.createNote}
      />
      <CommitDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        committing={committing}
        onCommit={actions.commitManual}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={COMMANDS}
        notes={notePaths}
        onRunCommand={runCommand}
        onOpenNote={(p) => {
          navigate(noteUrl(p));
          setPaletteOpen(false);
        }}
      />
    </>
  );
}
