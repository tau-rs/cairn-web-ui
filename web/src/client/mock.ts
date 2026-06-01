import type {
  Command,
  Query,
  Event,
  CommandResponse,
  QueryResponse,
  ContractError,
  NoteSummary,
  GraphEdge,
} from "../contract";
import type { CairnClient, Unsubscribe } from "./types";
import { extractLinks, stem } from "./wikilink";

/** Split a leading `---\n...\n---\n` frontmatter block. Mirrors cairn-domain
 *  Note::parse (frontmatter is the YAML between fences; body is the rest). */
function splitFrontmatter(raw: string): { frontmatter: string | null; body: string } {
  if (!raw.startsWith("---\n")) return { frontmatter: null, body: raw };
  const rest = raw.slice(4);
  if (rest.startsWith("---\n")) return { frontmatter: "", body: rest.slice(4) };
  const end = rest.indexOf("\n---\n");
  if (end === -1) return { frontmatter: null, body: raw };
  return { frontmatter: rest.slice(0, end), body: rest.slice(end + 5) };
}

/** display_title: frontmatter `title:`, else first `# ` heading, else stem.
 *  Mirrors cairn-domain Note::display_title. */
function displayTitle(path: string, raw: string): string {
  const { frontmatter, body } = splitFrontmatter(raw);
  if (frontmatter !== null) {
    for (const line of frontmatter.split("\n")) {
      const t = line.trimStart();
      if (t.startsWith("title:")) {
        const v = t.slice("title:".length).trim().replace(/^["']+|["']+$/g, "").trim();
        if (v) return v;
      }
    }
  }
  for (const line of body.split("\n")) {
    const t = line.trimStart();
    if (t.startsWith("# ")) {
      const v = t.slice(2).trim();
      if (v) return v;
    }
  }
  return stem(path);
}

/** In-memory faithful mock of the cairn engine + cairn-service dispatch. */
export class MockClient implements CairnClient {
  private notes: Map<string, string>;
  private subscribers = new Set<(e: Event) => void>();
  private commitSeq = 0;

  constructor(seed: Record<string, string> = {}) {
    this.notes = new Map(Object.entries(seed));
  }

  subscribe(cb: (e: Event) => void): Unsubscribe {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private emit(e: Event): void {
    // Asynchronous so subscribers see push-after-the-fact timing.
    queueMicrotask(() => this.subscribers.forEach((cb) => cb(e)));
  }

  private stemIndex(): Map<string, string> {
    const byStem = new Map<string, string>();
    for (const path of this.notes.keys()) byStem.set(stem(path), path);
    return byStem;
  }

  async sendCommand(c: Command): Promise<CommandResponse> {
    switch (c.type) {
      case "write_note":
        this.notes.set(c.path, c.contents);
        this.emit({ type: "note_changed", path: c.path });
        this.emit({ type: "reindexed", count: this.notes.size });
        return { type: "done" };
      case "delete_note":
        this.notes.delete(c.path);
        this.emit({ type: "note_deleted", path: c.path });
        this.emit({ type: "reindexed", count: this.notes.size });
        return { type: "done" };
      case "commit": {
        this.commitSeq += 1;
        const commit = `c${String(this.commitSeq).padStart(4, "0")}`;
        this.emit({ type: "committed", commit });
        return { type: "committed", commit };
      }
    }
  }

  async runQuery(q: Query): Promise<QueryResponse> {
    switch (q.type) {
      case "get_note": {
        const contents = this.notes.get(q.path);
        if (contents === undefined) {
          const err: ContractError = { type: "not_found", what: q.path };
          throw err;
        }
        return { type: "note", contents };
      }
      case "search": {
        const needle = q.query.toLowerCase();
        const paths = [...this.notes.entries()]
          .filter(
            ([path, raw]) =>
              splitFrontmatter(raw).body.toLowerCase().includes(needle) ||
              path.toLowerCase().includes(needle),
          )
          .map(([path]) => path)
          .sort();
        return { type: "paths", paths };
      }
      case "get_backlinks": {
        const byStem = this.stemIndex();
        const paths = [
          ...new Set(
            [...this.notes.entries()]
              .filter(([, raw]) =>
                extractLinks(splitFrontmatter(raw).body).some((t) => byStem.get(t) === q.path),
              )
              .map(([path]) => path),
          ),
        ].sort();
        return { type: "paths", paths };
      }
      case "list_notes": {
        const notes: NoteSummary[] = [...this.notes.entries()]
          .map(([path, raw]) => ({ path, title: displayTitle(path, raw) }))
          .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
        return { type: "notes", notes };
      }
      case "get_graph": {
        const byStem = this.stemIndex();
        const nodes = [...this.notes.keys()].sort();
        const seen = new Set<string>();
        const edges: GraphEdge[] = [];
        for (const [from, raw] of this.notes.entries()) {
          for (const target of extractLinks(splitFrontmatter(raw).body)) {
            const to = byStem.get(target);
            if (to && !seen.has(`${from} ${to}`)) {
              seen.add(`${from} ${to}`);
              edges.push({ from, to });
            }
          }
        }
        edges.sort((a, b) =>
          a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1,
        );
        return { type: "graph", nodes, edges };
      }
    }
  }

  /** Test/dev helper: current note paths. */
  paths(): string[] {
    return [...this.notes.keys()].sort();
  }
}
