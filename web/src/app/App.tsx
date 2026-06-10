import { useEffect, useState } from "react";
import { GraphView } from "../components/GraphView";
import { Shell } from "../components/Shell";
import { NoteList } from "../components/NoteList";
import { Editor } from "../components/Editor";
import { Backlinks } from "../components/Backlinks";
import { SearchBar } from "../components/SearchBar";
import { SearchResults } from "../components/SearchResults";
import { CommitBar } from "../components/CommitBar";
import { ErrorToast } from "../components/ErrorToast";
import { IconButton } from "../components/ui/IconButton";
import { SettingsDialog } from "../components/SettingsDialog";
import { NewNoteDialog } from "../components/NewNoteDialog";
import { CommitDialog } from "../components/CommitDialog";
import {
  CommandPalette,
  type PaletteCommand,
} from "../components/command-palette/CommandPalette";
import { OpenCairn } from "../components/OpenCairn";
import { cairnStore, useCairn } from "./cairnStore";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notePaths = useCairn((s) => s.notePaths);
  const activePath = useCairn((s) => s.activePath);
  const activeContents = useCairn((s) => s.activeContents);
  const editorMode = useCairn((s) => s.settings.editorMode);
  const settings = useCairn((s) => s.settings);
  const backlinks = useCairn((s) => s.backlinks);
  const query = useCairn((s) => s.query);
  const searchResults = useCairn((s) => s.searchResults);
  const saving = useCairn((s) => s.saving);
  const dirty = useCairn((s) => s.dirty);
  const uncommitted = useCairn((s) => s.uncommitted);
  const lastCommit = useCairn((s) => s.lastCommit);
  const committing = useCairn((s) => s.committing);
  const cairnPath = useCairn((s) => s.cairnPath);
  const error = useCairn((s) => s.error);
  const graph = useCairn((s) => s.graph);
  const noteTags = useCairn((s) => s.noteTags);
  const [view, setView] = useState<"editor" | "graph">("editor");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Store action functions are stable for the store's lifetime (Zustand never
  // replaces them; they read fresh state via get()), so capturing them once is safe.
  const actions = cairnStore.getState();

  if (cairnPath === null) {
    return <OpenCairn onOpen={() => void actions.openCairn()} />;
  }

  const COMMANDS: PaletteCommand[] = [
    { id: "new-note", label: "New note" },
    { id: "commit", label: "Commit changes…" },
    { id: "toggle-view", label: "Toggle Graph / Editor" },
    { id: "open-settings", label: "Open Settings" },
    { id: "toggle-editor-mode", label: "Toggle Source / Live preview" },
  ];
  const runCommand = (id: string) => {
    switch (id) {
      case "new-note":
        setNewNoteOpen(true);
        break;
      case "commit":
        setCommitOpen(true);
        break;
      case "toggle-view":
        setView((v) => {
          const next = v === "graph" ? "editor" : "graph";
          if (next === "graph") void actions.loadGraph();
          return next;
        });
        break;
      case "open-settings":
        setSettingsOpen(true);
        break;
      case "toggle-editor-mode":
        actions.setSettings({
          editorMode: editorMode === "livepreview" ? "source" : "livepreview",
        });
        break;
    }
    setPaletteOpen(false);
  };

  return (
    <>
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
              onClick={() => {
                const next = view === "graph" ? "editor" : "graph";
                setView(next);
                if (next === "graph") void actions.loadGraph();
              }}
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
          <NoteList
            paths={notePaths}
            activePath={activePath}
            onOpen={actions.openNote}
            onRequestNew={() => setNewNoteOpen(true)}
            onDelete={actions.deleteNote}
          />
        }
        editor={
          <div className="relative h-full">
            <SearchResults
              results={searchResults}
              onOpen={(p) => {
                void actions.openNote(p);
                actions.closeSearch();
              }}
              onClose={actions.closeSearch}
            />
            {view === "graph" ? (
              <GraphView
                nodes={graph?.nodes ?? []}
                edges={graph?.edges ?? []}
                tagsByNote={noteTags}
                activePath={activePath}
                onOpenNote={(p) => {
                  void actions.openNote(p);
                  setView("editor");
                }}
              />
            ) : (
              <Editor
                path={activePath}
                value={activeContents}
                mode={editorMode}
                notePaths={notePaths}
                assetUrl={actions.assetUrl}
                onChange={actions.editBuffer}
                onOpenNote={actions.openNote}
                onToggleMode={() =>
                  actions.setSettings({
                    editorMode:
                      editorMode === "livepreview" ? "source" : "livepreview",
                  })
                }
              />
            )}
          </div>
        }
        backlinks={<Backlinks paths={backlinks} onOpen={actions.openNote} />}
      />
      <ErrorToast message={error} onDismiss={actions.dismissError} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={actions.setSettings}
      />
      <NewNoteDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
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
          void actions.openNote(p);
          setView("editor");
          setPaletteOpen(false);
        }}
      />
    </>
  );
}
