import { useEffect } from "react";
import { Shell } from "../components/Shell";
import { NoteList } from "../components/NoteList";
import { cairnStore, useCairn } from "./cairnStore";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  const notePaths = useCairn((s) => s.notePaths);
  const activePath = useCairn((s) => s.activePath);
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
      editor={<div>editor</div>}
      backlinks={<div>backlinks</div>}
    />
  );
}
