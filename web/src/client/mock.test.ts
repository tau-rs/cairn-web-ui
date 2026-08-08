import { describe, it, expect, vi } from "vitest";
import { MockClient } from "./mock";
import type { Event, AnswerEvent } from "../contract";

function freshNotes() {
  return { "a.md": "links to [[b]]", "b.md": "target note" };
}

describe("MockClient", () => {
  it("get_note returns the note variant", async () => {
    const c = new MockClient(freshNotes());
    expect(await c.runQuery({ type: "get_note", path: "a.md" })).toEqual({
      type: "note",
      contents: "links to [[b]]",
    });
  });

  it("get_note rejects with not_found for a missing note", async () => {
    const c = new MockClient(freshNotes());
    await expect(
      c.runQuery({ type: "get_note", path: "missing.md" }),
    ).rejects.toEqual({
      type: "not_found",
      what: "missing.md",
    });
  });

  it("search matches body and path, case-insensitive, sorted by path", async () => {
    const c = new MockClient({
      "zeta.md": "alpha note",
      "alpha.md": "zeta body",
    });
    expect(await c.runQuery({ type: "search", query: "ALPHA" })).toEqual({
      type: "search_results",
      results: [
        { path: "alpha.md", score: 0, snippet: "zeta body", highlights: [] },
        {
          path: "zeta.md",
          score: 1,
          snippet: "alpha note",
          highlights: [[0, 5]],
        },
      ],
    });
  });

  it("get_backlinks resolves by stem, sorted and deduped", async () => {
    const c = new MockClient(freshNotes());
    expect(await c.runQuery({ type: "get_backlinks", path: "b.md" })).toEqual({
      type: "paths",
      paths: ["a.md"],
    });
  });

  it("list_notes returns a NoteSummary per note with display titles, sorted by path", async () => {
    const c = new MockClient({
      "a.md": "---\ntitle: Alpha\n---\nbody",
      "b.md": "# Heading B\ntext",
      "c.md": "no title here",
    });
    expect(await c.runQuery({ type: "list_notes" })).toEqual({
      type: "notes",
      notes: [
        { path: "a.md", title: "Alpha", tags: [] },
        { path: "b.md", title: "Heading B", tags: [] },
        { path: "c.md", title: "c", tags: [] },
      ],
    });
  });

  it("get_graph returns sorted nodes and resolved directed edges", async () => {
    const c = new MockClient(freshNotes());
    expect(
      await c.runQuery({ type: "get_graph", scope: { type: "full" } }),
    ).toEqual({
      type: "graph",
      nodes: [
        { path: "a.md", title: "a", degree: 1, tags: [], mtime_secs: 0n },
        { path: "b.md", title: "b", degree: 1, tags: [], mtime_secs: 0n },
      ],
      edges: [{ from: "a.md", to: "b.md" }],
    });
  });

  it("get_graph populates undirected degree and frontmatter tags per node", async () => {
    // hub links to two leaves; hub has frontmatter tags, leaves have none.
    const c = new MockClient({
      "hub.md": "---\ntags: [x, y]\n---\n[[leaf1]] and [[leaf2]]",
      "leaf1.md": "one",
      "leaf2.md": "two",
    });
    const res = await c.runQuery({
      type: "get_graph",
      scope: { type: "full" },
    });
    expect(res).toEqual({
      type: "graph",
      nodes: [
        {
          path: "hub.md",
          title: "hub",
          degree: 2,
          tags: ["x", "y"],
          mtime_secs: 0n,
        },
        {
          path: "leaf1.md",
          title: "leaf1",
          degree: 1,
          tags: [],
          mtime_secs: 0n,
        },
        {
          path: "leaf2.md",
          title: "leaf2",
          degree: 1,
          tags: [],
          mtime_secs: 0n,
        },
      ],
      edges: [
        { from: "hub.md", to: "leaf1.md" },
        { from: "hub.md", to: "leaf2.md" },
      ],
    });
  });

  it("get_graph focused scope returns the neighborhood within depth", async () => {
    // a -> b -> c chain; focus b @ depth 1 reaches a and c, not the isolated d.
    const c = new MockClient({
      "a.md": "links [[b]]",
      "b.md": "links [[c]]",
      "c.md": "leaf",
      "d.md": "isolated",
    });
    expect(
      await c.runQuery({
        type: "get_graph",
        scope: { type: "focused", path: "b.md", depth: 1 },
      }),
    ).toEqual({
      type: "graph",
      nodes: [
        { path: "a.md", title: "a", degree: 1, tags: [], mtime_secs: 0n },
        { path: "b.md", title: "b", degree: 2, tags: [], mtime_secs: 0n },
        { path: "c.md", title: "c", degree: 1, tags: [], mtime_secs: 0n },
      ],
      edges: [
        { from: "a.md", to: "b.md" },
        { from: "b.md", to: "c.md" },
      ],
    });
  });

  it("graph_at builds the graph from the vault snapshot at that revspec", async () => {
    const c = new MockClient(
      freshNotes(),
      {},
      {
        r1: { notes: { "a.md": "start" } },
        r2: { notes: { "a.md": "links [[b]]", "b.md": "hi" } },
      },
    );
    expect(
      await c.runQuery({
        type: "graph_at",
        revision: "r2",
        scope: { type: "full" },
      }),
    ).toEqual({
      type: "graph",
      nodes: [
        { path: "a.md", title: "a", degree: 1, tags: [], mtime_secs: 0n },
        { path: "b.md", title: "b", degree: 1, tags: [], mtime_secs: 0n },
      ],
      edges: [{ from: "a.md", to: "b.md" }],
    });
  });

  it("graph_at rejects an unknown revspec", async () => {
    const c = new MockClient(freshNotes());
    await expect(
      c.runQuery({
        type: "graph_at",
        revision: "nope",
        scope: { type: "full" },
      }),
    ).rejects.toEqual({ type: "not_found", what: "nope" });
  });

  it("graph_diff reports added and removed nodes and edges", async () => {
    const c = new MockClient(
      freshNotes(),
      {},
      {
        r1: { notes: { "a.md": "lone" } },
        r2: { notes: { "a.md": "links [[b]]", "b.md": "hi" } },
      },
    );
    expect(
      await c.runQuery({
        type: "graph_diff",
        from: "r1",
        to: "r2",
        scope: { type: "full" },
      }),
    ).toEqual({
      type: "graph_diff",
      nodes_added: [
        { path: "b.md", title: "b", degree: 1, tags: [], mtime_secs: 0n },
      ],
      nodes_removed: [],
      // a.md is in both revisions but gained a link (degree 0 → 1), so it is a
      // changed node carrying its to-revision metadata.
      nodes_changed: [
        { path: "a.md", title: "a", degree: 1, tags: [], mtime_secs: 0n },
      ],
      edges_added: [{ from: "a.md", to: "b.md" }],
      edges_removed: [],
    });
  });

  it("write_note upserts and emits note_changed then reindexed; returns done", async () => {
    const c = new MockClient(freshNotes());
    const events: Event[] = [];
    c.subscribe((e) => events.push(e));
    const res = await c.sendCommand({
      type: "write_note",
      path: "c.md",
      contents: "new [[a]]",
    });
    expect(res).toEqual({ type: "done" });
    await vi.waitFor(() =>
      expect(events).toEqual([
        { type: "note_changed", path: "c.md" },
        { type: "reindexed", count: 3 },
      ]),
    );
  });

  it("delete_note removes and emits note_deleted then reindexed; returns done", async () => {
    const c = new MockClient(freshNotes());
    const events: Event[] = [];
    c.subscribe((e) => events.push(e));
    const res = await c.sendCommand({ type: "delete_note", path: "b.md" });
    expect(res).toEqual({ type: "done" });
    await vi.waitFor(() =>
      expect(events).toEqual([
        { type: "note_deleted", path: "b.md" },
        { type: "reindexed", count: 1 },
      ]),
    );
    expect(await c.runQuery({ type: "search", query: "target" })).toEqual({
      type: "search_results",
      results: [],
    });
  });

  it("delete_note rejects with not_found for a missing note", async () => {
    const c = new MockClient(freshNotes());
    await expect(
      c.sendCommand({ type: "delete_note", path: "ghost.md" }),
    ).rejects.toEqual({
      type: "not_found",
      what: "ghost.md",
    });
  });

  it("commit returns committed with a short id and emits committed", async () => {
    const c = new MockClient(freshNotes());
    const events: Event[] = [];
    c.subscribe((e) => events.push(e));
    const res = await c.sendCommand({ type: "commit", message: "first" });
    expect(res).toEqual({ type: "committed", commit: "c0001" });
    await vi.waitFor(() =>
      expect(events).toContainEqual({ type: "committed", commit: "c0001" }),
    );
  });

  it("noteTags parses tags from note content", async () => {
    const c = new MockClient({
      "a.md": "---\ntags: [x, y]\n---\nbody #z",
      "b.md": "plain",
    });
    expect(await c.noteTags()).toEqual({ "a.md": ["x", "y"], "b.md": [] });
  });

  it("list_tags counts distinct frontmatter tags, sorted", async () => {
    const c = new MockClient({
      "a.md": "---\ntags: [rust, ideas]\n---\nx",
      "b.md": "---\ntags: [rust]\n---\ny",
      "c.md": "no tags",
    });
    expect(await c.runQuery({ type: "list_tags" })).toEqual({
      type: "tags",
      tags: [
        { tag: "ideas", count: 1 },
        { tag: "rust", count: 2 },
      ],
    });
  });
  it("notes_by_tag returns matching paths, sorted", async () => {
    const c = new MockClient({
      "a.md": "---\ntags: [rust]\n---\nx",
      "b.md": "---\ntags: [ideas]\n---\ny",
      "z.md": "---\ntags: [rust]\n---\nz",
    });
    expect(await c.runQuery({ type: "notes_by_tag", tag: "rust" })).toEqual({
      type: "paths",
      paths: ["a.md", "z.md"],
    });
  });
  it("rename_note moves the note and rewrites [[wikilinks]] when the stem changes", async () => {
    const c = new MockClient({
      "a.md": "# A",
      "x.md": "see [[a]] and [[a|alias]]",
    });
    await c.sendCommand({ type: "rename_note", from: "a.md", to: "c.md" });
    expect(await c.runQuery({ type: "get_note", path: "c.md" })).toEqual({
      type: "note",
      contents: "# A",
    });
    await expect(
      c.runQuery({ type: "get_note", path: "a.md" }),
    ).rejects.toEqual({ type: "not_found", what: "a.md" });
    expect(await c.runQuery({ type: "get_note", path: "x.md" })).toEqual({
      type: "note",
      contents: "see [[c]] and [[c|alias]]",
    });
  });
  it("rename_note keeps links when only the folder changes (stem unchanged)", async () => {
    const c = new MockClient({ "a.md": "# A", "x.md": "see [[a]]" });
    await c.sendCommand({ type: "rename_note", from: "a.md", to: "sub/a.md" });
    expect(await c.runQuery({ type: "get_note", path: "x.md" })).toEqual({
      type: "note",
      contents: "see [[a]]",
    });
  });
  it("rename_note errors on a missing source and an existing target", async () => {
    const c = new MockClient({ "a.md": "x", "b.md": "y" });
    await expect(
      c.sendCommand({ type: "rename_note", from: "missing.md", to: "z.md" }),
    ).rejects.toEqual({ type: "not_found", what: "missing.md" });
    await expect(
      c.sendCommand({ type: "rename_note", from: "a.md", to: "b.md" }),
    ).rejects.toMatchObject({ type: "invalid_request" });
  });
  it("list_plugins returns the seeded demo + bare + wordcount plugins", async () => {
    const c = new MockClient({});
    const res = await c.runQuery({ type: "list_plugins" });
    expect(res.type).toBe("plugins");
    if (res.type !== "plugins") return;
    expect(res.plugins.map((p) => p.id)).toEqual(["demo", "bare", "wordcount"]);
    const demo = res.plugins[0];
    expect(demo).toMatchObject({
      id: "demo",
      name: "Demo plugin",
      version: "1.0.0",
      commands: [{ id: "stamp", title: "Insert stamp note" }],
    });
    // demo seeds contributions across all three slots; bare seeds none.
    expect(demo.contributions.map((c) => c.slot)).toEqual([
      "sidebar.section",
      "topbar.action",
      "command",
    ]);
    expect(res.plugins[1].contributions).toEqual([]);
  });
  it("invoke_plugin_command demo/stamp writes a note and returns its path", async () => {
    const c = new MockClient({});
    const res = await c.sendCommand({
      type: "invoke_plugin_command",
      plugin: "demo",
      command: "stamp",
      args: null,
    });
    expect(res).toEqual({ type: "plugin_result", result: "stamp.md" });
    expect(
      await c.runQuery({ type: "get_note", path: "stamp.md" }),
    ).toMatchObject({ type: "note" });
  });
  it("invoke_plugin_command errors on an unknown command", async () => {
    const c = new MockClient({});
    await expect(
      c.sendCommand({
        type: "invoke_plugin_command",
        plugin: "demo",
        command: "nope",
        args: null,
      }),
    ).rejects.toMatchObject({ type: "invalid_request" });
  });
});

describe("mock history ops", () => {
  function withHistory() {
    const revs: import("../contract").Revision[] = [
      { id: "r2", message: "second", timestamp_secs: 2n, author: "tau" },
      { id: "r1", message: "first", timestamp_secs: 1n, author: "tau" },
    ];
    return new MockClient(
      { "n.md": "current body" },
      {
        "n.md": { revisions: revs, contents: { r2: "body v2", r1: "body v1" } },
      },
    );
  }

  it("note_history returns seeded revisions newest-first", async () => {
    const c = withHistory();
    const res = await c.runQuery({ type: "note_history", path: "n.md" });
    expect(res).toEqual({
      type: "history",
      revisions: [
        { id: "r2", message: "second", timestamp_secs: 2n, author: "tau" },
        { id: "r1", message: "first", timestamp_secs: 1n, author: "tau" },
      ],
    });
  });

  it("note_history returns [] for a note with no seeded history", async () => {
    const c = withHistory();
    const res = await c.runQuery({ type: "note_history", path: "other.md" });
    expect(res).toEqual({ type: "history", revisions: [] });
  });

  it("note_at returns historical contents", async () => {
    const c = withHistory();
    const res = await c.runQuery({
      type: "note_at",
      path: "n.md",
      revision: "r1",
    });
    expect(res).toEqual({ type: "note", contents: "body v1" });
  });

  it("note_at rejects an unknown revision with not_found", async () => {
    const c = withHistory();
    await expect(
      c.runQuery({ type: "note_at", path: "n.md", revision: "nope" }),
    ).rejects.toMatchObject({ type: "not_found" });
  });

  it("restore_note overwrites the working copy and emits note_changed", async () => {
    const c = withHistory();
    const events: string[] = [];
    c.subscribe((e) => events.push(e.type));
    const res = await c.sendCommand({
      type: "restore_note",
      path: "n.md",
      revision: "r1",
    });
    expect(res).toEqual({ type: "done" });
    const note = await c.runQuery({ type: "get_note", path: "n.md" });
    expect(note).toEqual({ type: "note", contents: "body v1" });
    await new Promise<void>((r) => queueMicrotask(r));
    expect(events).toContain("note_changed");
  });
});

describe("MockClient.ask", () => {
  function collect(client: MockClient, q: string): Promise<AnswerEvent[]> {
    return new Promise((resolve) => {
      const events: AnswerEvent[] = [];
      client.ask({ query: q, top_k: null }, (e) => {
        events.push(e);
        if (e.type === "completed" || e.type === "failed") resolve(events);
      });
    });
  }

  it("emits sources first and completed last on success", async () => {
    const client = new MockClient({ "store.md": "# Store\n" });
    const events = await collect(client, "how does it work?");
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("sources");
    expect(types).toContain("text_delta");
    expect(types[types.length - 1]).toBe("completed");
    const sources = events.find((e) => e.type === "sources");
    expect(sources).toEqual({ type: "sources", paths: ["store.md"] });
  });

  it("emits the failed path when the question contains 'fail'", async () => {
    const client = new MockClient({ "store.md": "x" });
    const events = await collect(client, "please fail");
    expect(events[events.length - 1]).toEqual({
      type: "failed",
      message: "stream interrupted (mock)",
    });
  });

  it("unsubscribe stops further events", async () => {
    const client = new MockClient({ "store.md": "x" });
    const seen: AnswerEvent[] = [];
    const unsub = client.ask({ query: "hello", top_k: null }, (e) =>
      seen.push(e),
    );
    unsub();
    await new Promise<void>((r) => queueMicrotask(() => queueMicrotask(r)));
    expect(seen.length).toBe(0);
  });
});

describe("MockClient get_suggestions", () => {
  const notes = {
    "index.md": "# Index [[ideas]] [[todo]]",
    "ideas.md": "# Ideas [[index]]",
    "todo.md": "---\ntags: [rust]\n---\n# Todo",
    "projects/demo.md": "---\ntags: [rust, ideas]\n---\n# Demo",
    "kitchensink.md": "# Kitchen sink [[ideas]]",
  };

  it("returns curated vault-scope suggestions between existing notes", async () => {
    const c = new MockClient(notes);
    const res = await c.runQuery({
      type: "get_suggestions",
      scope: { type: "vault" },
    });
    expect(res).toEqual({
      type: "suggestions",
      suggestions: [
        {
          from: "projects/demo.md",
          to: "todo.md",
          weight: 0.82,
          why: "shared tag: rust",
        },
        {
          from: "projects/demo.md",
          to: "ideas.md",
          weight: 0.61,
          why: "shared tag: ideas",
        },
        {
          from: "kitchensink.md",
          to: "index.md",
          weight: 0.34,
          why: "co-mention: ideas",
        },
      ],
    });
  });

  it("filters to suggestions touching the note for note scope", async () => {
    const c = new MockClient(notes);
    const res = await c.runQuery({
      type: "get_suggestions",
      scope: { type: "note", path: "todo.md" },
    });
    expect(res).toEqual({
      type: "suggestions",
      suggestions: [
        {
          from: "projects/demo.md",
          to: "todo.md",
          weight: 0.82,
          why: "shared tag: rust",
        },
      ],
    });
  });

  it("drops curated edges whose endpoints are absent", async () => {
    const c = new MockClient({ "todo.md": "x" });
    const res = await c.runQuery({
      type: "get_suggestions",
      scope: { type: "vault" },
    });
    expect(res).toEqual({ type: "suggestions", suggestions: [] });
  });
});
