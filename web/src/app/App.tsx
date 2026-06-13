import { useEffect } from "react";
import { AppShell } from "../components/shells/AppShell";
import { OpenCairn } from "../components/OpenCairn";
import { RouteSync } from "./RouteSync";
import { cairnStore, useCairn } from "./cairnStore";
import { TopBar } from "../components/TopBar";
import { Sidebar } from "../components/Sidebar";
import { EditorPane } from "../components/EditorPane";
import { BacklinksPane } from "../components/BacklinksPane";
import { DialogHost } from "../components/DialogHost";
import { Toasts } from "../components/Toasts";
import { LiveUpdatesBanner } from "../components/LiveUpdatesBanner";
import { useCommands } from "./useCommands";
import { useGlobalKeys } from "../components/shortcuts/useGlobalKeys";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  const cairnPath = useCairn((s) => s.cairnPath);
  const liveUpdates = useCairn((s) => s.liveUpdates);
  const { commands, chordMap, runCommand } = useCommands();
  useGlobalKeys(chordMap, runCommand);

  if (cairnPath === null) {
    return <OpenCairn onOpen={() => void cairnStore.getState().openCairn()} />;
  }

  return (
    <>
      <RouteSync />
      <AppShell
        topBar={<TopBar />}
        list={<Sidebar />}
        editor={<EditorPane />}
        backlinks={<BacklinksPane />}
      />
      <DialogHost commands={commands} onRunCommand={runCommand} />
      <Toasts />
      <LiveUpdatesBanner
        status={liveUpdates}
        onRefresh={() => void cairnStore.getState().refreshAll()}
      />
    </>
  );
}
