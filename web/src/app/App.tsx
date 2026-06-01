import { useEffect } from "react";
import { Shell } from "../components/Shell";
import { cairnStore } from "./cairnStore";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  return (
    <Shell
      topBar={<span className="text-sm text-neutral-400">Cairn</span>}
      list={<div>notes</div>}
      editor={<div>editor</div>}
      backlinks={<div>backlinks</div>}
    />
  );
}
