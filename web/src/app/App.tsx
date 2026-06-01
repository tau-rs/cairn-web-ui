import { useEffect } from "react";
import { Shell } from "../components/Shell";
import { NoteList } from "../components/NoteList";
import { Editor } from "../components/Editor";
import { Backlinks } from "../components/Backlinks";
import { SearchBar } from "../components/SearchBar";
import { SearchResults } from "../components/SearchResults";
import { CommitBar } from "../components/CommitBar";
import { Settings } from "../components/Settings";
import { ErrorToast } from "../components/ErrorToast";
import { OpenCairn } from "../components/OpenCairn";
import { cairnStore, useCairn } from "./cairnStore";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
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
  // Store action functions are stable for the store's lifetime (Zustand never
  // replaces them; they read fresh state via get()), so capturing them once is safe.
  const actions = cairnStore.getState();

  if (cairnPath === null) {
    return <OpenCairn onOpen={() => void actions.openCairn()} />;
  }

  return (
    <>
      <Shell
        topBar={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-400">Cairn</span>
              <SearchBar
                value={query}
                onChange={actions.setQuery}
                onSearch={actions.runSearch}
              />
            </div>
            <CommitBar
              saving={saving}
              dirty={dirty}
              uncommitted={uncommitted}
              lastCommit={lastCommit}
              committing={committing}
              onCommit={actions.commitManual}
            />
          </div>
        }
        list={
          <NoteList
            paths={notePaths}
            activePath={activePath}
            onOpen={actions.openNote}
            onNew={actions.createNote}
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
            <Editor
              path={activePath}
              value={activeContents}
              mode={editorMode}
              onChange={actions.editBuffer}
              onToggleMode={() =>
                actions.setSettings({
                  editorMode: editorMode === "rich" ? "raw" : "rich",
                })
              }
            />
          </div>
        }
        backlinks={
          <div className="flex flex-col gap-4">
            <Backlinks paths={backlinks} onOpen={actions.openNote} />
            <Settings settings={settings} onChange={actions.setSettings} />
          </div>
        }
      />
      <ErrorToast message={error} onDismiss={actions.dismissError} />
    </>
  );
}
