import { invoke, convertFileSrc } from "@tauri-apps/api/core";
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
  noteTags(): Promise<Record<string, string[]>> {
    // Stub: the engine does not expose tags yet. Swap for a query when it does.
    return Promise.resolve({});
  }
}

/** App-level cairn lifecycle over Tauri commands. */
export class TauriHost implements CairnHost {
  private root: string | null = null;
  async currentCairn(): Promise<string | null> {
    this.root = await invoke<string | null>("current_cairn");
    return this.root;
  }
  async openCairn(): Promise<string | null> {
    this.root = await invoke<string | null>("pick_and_open_cairn");
    return this.root;
  }
  assetUrl(relPath: string): string {
    if (/^(https?:|data:)/i.test(relPath)) return relPath;
    if (!this.root) return relPath;
    const sep = this.root.endsWith("/") ? "" : "/";
    return convertFileSrc(`${this.root}${sep}${relPath}`);
  }
}
