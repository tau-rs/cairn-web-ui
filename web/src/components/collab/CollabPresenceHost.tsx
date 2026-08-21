import { useEffect } from "react";
import { useCairn, useActions } from "../../app/cairnStore";
import { CollabPresencePill } from "./CollabPresencePill";

/** Follows the focused pane's active note into a live `/collab` presence session
 *  and renders the corner pill. Session lifecycle lives in collabSlice; this is
 *  the thin per-corner subscription (mirrors AskPanelHost). */
export function CollabPresenceHost() {
  const activePath = useCairn((s) => s.activePath);
  const collab = useCairn((s) => s.collab);
  const dirty = useCairn((s) =>
    s.activePath ? (s.openNotes[s.activePath]?.dirty ?? false) : false,
  );
  const actions = useActions();

  useEffect(() => {
    if (activePath) actions.collabFollow(activePath);
    else actions.collabStop();
  }, [activePath, actions]);

  // Leave the session when the app tears down.
  useEffect(() => () => actions.collabStop(), [actions]);

  return (
    <CollabPresencePill
      collab={collab}
      dirty={dirty}
      onReload={actions.collabReloadNow}
    />
  );
}
