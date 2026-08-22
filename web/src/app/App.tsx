import { useEffect } from "react";
import { AppShell } from "../components/shells/AppShell";
import { StatusBar } from "../components/StatusBar";
import { OpenCairn } from "../components/OpenCairn";
import { RouteSync } from "./RouteSync";
import { cairnStore, useCairn } from "./cairnStore";
import { TopBar } from "../components/TopBar";
import { Sidebar } from "../components/Sidebar";
import { EditorPane } from "../components/EditorPane";
import { RightAside } from "../components/RightAside";
import { DialogHost } from "../components/DialogHost";
import { Toasts } from "../components/Toasts";
import { LiveUpdatesBanner } from "../components/LiveUpdatesBanner";
import { useCommands } from "./useCommands";
import { useGlobalKeys } from "../components/shortcuts/useGlobalKeys";
import { AskPanelHost } from "../components/ask/AskPanelHost";
import { RecoveryPanelHost } from "../components/recovery/RecoveryPanelHost";
import { CollabPresenceHost } from "../components/collab/CollabPresenceHost";

export default function App() {
  useEffect(() => {
    void cairnStore.getState().init();
  }, []);

  const cairnPath = useCairn((s) => s.cairnPath);
  const liveUpdates = useCairn((s) => s.liveUpdates);
  const saving = useCairn((s) => s.saving);
  const dirty = useCairn((s) => s.dirty);
  const lastVersion = useCairn((s) => s.lastVersion);
  const { commands, chordMap, runCommand } = useCommands();
  useGlobalKeys(chordMap, runCommand);

  if (cairnPath === null) {
    return <OpenCairn onOpen={() => void cairnStore.getState().openCairn()} />;
  }

  return (
    <>
      <RouteSync />
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <AppShell
            topBar={<TopBar />}
            list={<Sidebar />}
            editor={<EditorPane />}
            backlinks={<RightAside />}
            ask={<AskPanelHost />}
            recovery={<RecoveryPanelHost />}
          />
        </div>
        <StatusBar
          saving={saving}
          dirty={dirty}
          sync={liveUpdates}
          lastVersion={lastVersion}
          onShowVersions={() => cairnStore.getState().showHistory()}
        />
      </div>
      <DialogHost commands={commands} onRunCommand={runCommand} />
      <Toasts />
      <LiveUpdatesBanner
        status={liveUpdates}
        onRefresh={() => void cairnStore.getState().refreshAll()}
      />
      <CollabPresenceHost />
    </>
  );
}
