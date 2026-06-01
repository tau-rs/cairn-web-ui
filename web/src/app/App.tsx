import { useEffect } from "react";
import { Shell } from "../components/Shell";
import { NoteList } from "../components/NoteList";
import { Editor } from "../components/Editor";
import { Backlinks } from "../components/Backlinks";
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
  const actions = cairnStore.getState();

  return (
    <Shell
      topBar={<span className="text-sm text-neutral-400">Cairn</span>}
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
        <Editor
          path={activePath}
          value={activeContents}
          mode={editorMode}
          onChange={actions.editBuffer}
          onToggleMode={() =>
            actions.setSettings({ editorMode: editorMode === "rich" ? "raw" : "rich" })
          }
        />
      }
      backlinks={<Backlinks paths={backlinks} onOpen={actions.openNote} />}
    />
  );
}
