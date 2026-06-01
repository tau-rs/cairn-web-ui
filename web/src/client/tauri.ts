import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Command,
  Query,
  Event,
  CommandResponse,
  QueryResponse,
} from "../contract";
import type { CairnClient, Unsubscribe } from "./types";
import type { CairnHost } from "./host";

/** Talks to the Rust backend over Tauri IPC. Rejections are ContractError
 *  (the Err payload of the Rust command), matching MockClient. */
export class TauriClient implements CairnClient {
  sendCommand(command: Command): Promise<CommandResponse> {
    return invoke<CommandResponse>("send_command", { command });
  }
  runQuery(query: Query): Promise<QueryResponse> {
    return invoke<QueryResponse>("run_query", { query });
  }
  subscribe(cb: (e: Event) => void): Unsubscribe {
    const pending = listen<Event>("cairn://event", (e) => cb(e.payload));
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void pending.then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }
}

/** App-level cairn lifecycle over Tauri commands. */
export class TauriHost implements CairnHost {
  currentCairn(): Promise<string | null> {
    return invoke<string | null>("current_cairn");
  }
  openCairn(): Promise<string | null> {
    return invoke<string | null>("pick_and_open_cairn");
  }
}
