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
      type: "paths",
      paths: ["alpha.md", "zeta.md"],
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
        { path: "a.md", title: "Alpha" },
        { path: "b.md", title: "Heading B" },
        { path: "c.md", title: "c" },
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
      type: "paths",
      paths: [],
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
});
