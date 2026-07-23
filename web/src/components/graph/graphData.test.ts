import { describe, it, expect } from "vitest";
import {
  buildGraphData,
  buildAdjacency,
  nodeRadius,
  labelAlpha,
} from "./graphData";

describe("buildGraphData", () => {
  const nodes = ["a.md", "b.md", "c.md"];
  const edges = [
    { from: "a.md", to: "b.md" },
    { from: "a.md", to: "c.md" },
    { from: "a.md", to: "missing.md" }, // dropped: endpoint not in nodes
  ];
  it("labels nodes by stem and counts undirected degree", () => {
    const { nodes: gn } = buildGraphData(nodes, edges);
    const byId = Object.fromEntries(gn.map((n) => [n.id, n]));
    expect(byId["a.md"].label).toBe("a");
    expect(byId["a.md"].degree).toBe(2); // a–b, a–c (missing dropped)
    expect(byId["b.md"].degree).toBe(1);
    expect(byId["c.md"].degree).toBe(1);
  });
  it("drops links whose endpoint is not a known node", () => {
    const { links } = buildGraphData(nodes, edges);
    expect(links).toEqual([
      { source: "a.md", target: "b.md" },
      { source: "a.md", target: "c.md" },
    ]);
  });
});

describe("buildAdjacency", () => {
  it("builds symmetric neighbor sets", () => {
    const adj = buildAdjacency([
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ]);
    expect([...(adj.get("a") ?? [])].sort()).toEqual(["b", "c"]);
    expect([...(adj.get("b") ?? [])]).toEqual(["a"]);
    expect(adj.get("z")).toBeUndefined(); // isolated / unknown
  });
});

describe("nodeRadius", () => {
  it("is base at degree 0 and monotonic non-decreasing", () => {
    expect(nodeRadius(0)).toBe(3);
    expect(nodeRadius(1)).toBeGreaterThan(nodeRadius(0));
    expect(nodeRadius(9)).toBeGreaterThan(nodeRadius(4));
  });
});

describe("labelAlpha", () => {
  it("is 0 when zoomed out, 1 when zoomed in, clamped and monotonic", () => {
    expect(labelAlpha(1.0)).toBe(0);
    expect(labelAlpha(3.0)).toBe(1);
    const mid = labelAlpha(1.85);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

import { buildCompareGraphData } from "./graphData";
import type { GraphNode, GraphEdge } from "../../contract";

const gn = (path: string): GraphNode => ({
  path,
  title: path,
  degree: 0,
  tags: [],
  mtime_secs: 0n,
});
const ge = (from: string, to: string): GraphEdge => ({ from, to });

describe("buildCompareGraphData", () => {
  // base `to` = {a,b,c}, a-b, b-c ; diff: c appeared (+ b-c), x disappeared (+ a-x)
  const base = {
    nodes: [gn("a"), gn("b"), gn("c")],
    edges: [ge("a", "b"), ge("b", "c")],
  };
  const diff = {
    nodes_added: [gn("c")],
    nodes_removed: [gn("x")],
    edges_added: [ge("b", "c")],
    edges_removed: [ge("a", "x")],
  };

  it("labels appeared / disappeared / unchanged and injects removed nodes", () => {
    const { nodes, links } = buildCompareGraphData(base, diff);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n.state]));
    expect(byId).toEqual({
      a: "unchanged",
      b: "unchanged",
      c: "appeared",
      x: "disappeared",
    });
    const linkState = links.map((l) => [l.source, l.target, l.state]);
    expect(linkState).toContainEqual(["a", "b", "unchanged"]);
    expect(linkState).toContainEqual(["b", "c", "appeared"]);
    expect(linkState).toContainEqual(["a", "x", "disappeared"]);
  });

  it("never emits a changed state", () => {
    const { nodes, links } = buildCompareGraphData(base, diff);
    expect(nodes.every((n) => n.state !== "changed")).toBe(true);
    expect(links.every((l) => l.state !== "changed")).toBe(true);
  });
});
