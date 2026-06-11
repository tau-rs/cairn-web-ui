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
import { confineToRoot } from "./vaultPath";

/** Talks to the Rust backend over Tauri IPC. Rejections are ContractError
 *  (the Err payload of the Rust command), matching MockClient. */
export class TauriClient implements CairnClient {
  sendCommand(command: Command): Promise<CommandResponse> {
    return invoke<CommandResponse>("send_command", { command });
  }
  runQuery(query: Query): Promise<QueryResponse> {
    return invoke<QueryResponse>("run_query", { query });
  }
  subscribe(
    cb: (e: Event) => void,
    onError?: (err: unknown) => void,
  ): Unsubscribe {
    const pending = listen<Event>("cairn://event", (e) => cb(e.payload));
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    pending.then(
      (fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      },
      (err) => {
        // The channel never attached: the whole reactive-refresh model depends
        // on these push events, so report it rather than leave an unhandled
        // rejection and a silently-stale UI.
        if (!cancelled) onError?.(err);
      },
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }
  async noteTags(): Promise<Record<string, string[]>> {
    const res = await this.runQuery({ type: "list_notes" });
    if (res.type !== "notes") return {};
    return Object.fromEntries(res.notes.map((n) => [n.path, n.tags]));
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
    const full = confineToRoot(this.root, relPath);
    if (full === null) return ""; // path escapes the vault — refuse to resolve
    return convertFileSrc(full);
  }
}
