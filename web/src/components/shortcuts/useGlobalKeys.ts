import { useEffect, useRef } from "react";
import { cairnStore } from "../../app/cairnStore";
import { eventToChord } from "./keybinding";

/**
 * Global keydown dispatch: maps a chord to a command id via `chordMap` and runs
 * it through `runCommand`, plus the built-in (non-rebindable) tab navigation
 * (Ctrl+Tab / Mod+1-9). `runCommand` is held in a ref so the window listener
 * binds once per `chordMap` change, not on every render.
 */
export function useGlobalKeys(
  chordMap: Record<string, string>,
  runCommand: (id: string) => void,
) {
  const runCommandRef = useRef(runCommand);
  runCommandRef.current = runCommand;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const chord = eventToChord(e);
      const id = chord ? chordMap[chord] : undefined;
      if (id) {
        e.preventDefault();
        runCommandRef.current(id);
        return;
      }
      // Built-in tab navigation (parameterized; not rebindable).
      const st = cairnStore.getState();
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        st.cycleTab(e.shiftKey ? -1 : 1);
      } else if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        st.jumpToTab(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chordMap]);
}
