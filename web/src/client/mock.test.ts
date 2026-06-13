import { describe, it, expect, vi } from "vitest";
import { MockClient } from "./mock";
import type { Event } from "../contract";

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
    expect(await c.runQuery({ type: "get_graph" })).toEqual({
      type: "graph",
      nodes: ["a.md", "b.md"],
      edges: [{ from: "a.md", to: "b.md" }],
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
  it("list_plugins returns the seeded demo + bare plugins", async () => {
    const c = new MockClient({});
    const res = await c.runQuery({ type: "list_plugins" });
    expect(res.type).toBe("plugins");
    if (res.type !== "plugins") return;
    expect(res.plugins.map((p) => p.id)).toEqual(["demo", "bare"]);
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
