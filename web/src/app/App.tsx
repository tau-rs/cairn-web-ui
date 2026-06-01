import { useEffect } from "react";
import { Shell } from "../components/Shell";
import { NoteList } from "../components/NoteList";
import { Editor } from "../components/Editor";
import { Backlinks } from "../components/Backlinks";
import { SearchBar } from "../components/SearchBar";
import { SearchResults } from "../components/SearchResults";
import { cairnStore, useCairn } from "./cairnStore";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  const notePaths = useCairn((s) => s.notePaths);
  const activePath = useCairn((s) => s.activePath);
  const activeContents = useCairn((s) => s.activeContents);
  const editorMode = useCairn((s) => s.settings.editorMode);
  const backlinks = useCairn((s) => s.backlinks);
  const query = useCairn((s) => s.query);
  const searchResults = useCairn((s) => s.searchResults);
  const actions = cairnStore.getState();

  return (
    <Shell
      topBar={
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">Cairn</span>
          <SearchBar value={query} onChange={actions.setQuery} onSearch={actions.runSearch} />
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
              actions.setSettings({ editorMode: editorMode === "rich" ? "raw" : "rich" })
            }
          />
        </div>
      }
      backlinks={<Backlinks paths={backlinks} onOpen={actions.openNote} />}
    />
  );
}
