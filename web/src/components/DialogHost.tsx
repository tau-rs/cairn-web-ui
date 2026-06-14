import { useNavigate } from "react-router-dom";
import { useCairn, useActions } from "../app/cairnStore";
import { noteUrl } from "../app/routes";
import { SettingsDialog } from "./SettingsDialog";
import { NewNoteDialog } from "./NewNoteDialog";
import { CommitDialog } from "./CommitDialog";
import {
  CommandPalette,
  type PaletteCommand,
} from "./command-palette/CommandPalette";
import { AskBar } from "./ask/AskBar";
import { resolveStem } from "./ask/citation";

export function DialogHost(props: {
  commands: PaletteCommand[];
  onRunCommand: (id: string) => void;
}) {
  const navigate = useNavigate();
  const actions = useActions();
  const ui = useCairn((s) => s.ui);
  const settings = useCairn((s) => s.settings);
  const plugins = useCairn((s) => s.plugins);
  const committing = useCairn((s) => s.committing);
  const notePaths = useCairn((s) => s.notePaths);
  const ask = useCairn((s) => s.ask);

  return (
    <>
      <SettingsDialog
        open={ui.settingsOpen}
        onOpenChange={(o) => actions.setUi({ settingsOpen: o })}
        settings={settings}
        onChange={actions.setSettings}
        keybindingOverrides={ui.keybindingOverrides}
        onKeybindingsChange={actions.setKeybindingOverrides}
        plugins={plugins}
      />
      <NewNoteDialog
        open={ui.newNoteOpen}
        onOpenChange={(o) => actions.setUi({ newNoteOpen: o })}
        initialPath={ui.newNoteInitial}
        onCreate={actions.createNote}
      />
      <CommitDialog
        open={ui.commitOpen}
        onOpenChange={(o) => actions.setUi({ commitOpen: o })}
        committing={committing}
        onCommit={actions.commitManual}
      />
      <CommandPalette
        open={ui.paletteOpen}
        onClose={() => actions.setUi({ paletteOpen: false })}
        commands={props.commands}
        notes={notePaths}
        onRunCommand={props.onRunCommand}
        onOpenNote={(p) => {
          navigate(noteUrl(p));
          actions.setUi({ paletteOpen: false });
        }}
      />
      <AskBar
        open={ask.mode === "bar"}
        turns={ask.turns}
        streaming={ask.streaming}
        error={ask.error}
        onSubmit={actions.askSubmit}
        onPromote={actions.askPromote}
        onClose={actions.askClose}
        onOpenNote={(target) => {
          const path = resolveStem(notePaths, target);
          if (path) {
            navigate(noteUrl(path));
            actions.askClose();
          }
        }}
      />
    </>
  );
}
