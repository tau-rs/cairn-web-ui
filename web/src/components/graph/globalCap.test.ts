import { describe, it, expect } from "vitest";
import { capByDegree } from "./globalCap";
import type { GraphNode } from "../../contract";

const n = (path: string, degree: number): GraphNode => ({
  path,
  title: path,
  degree,
  tags: [],
  mtime_secs: 0n,
});

describe("capByDegree", () => {
  it("returns everything untruncated under the limit", () => {
    const nodes = [n("a", 1), n("b", 0)];
    const edges = [{ from: "a", to: "b" }];
    const r = capByDegree(nodes, edges, 10);
    expect(r.truncated).toBe(false);
    expect(r.total).toBe(2);
    expect(r.nodes).toHaveLength(2);
  });
  it("keeps the top-N by degree and drops edges to dropped nodes", () => {
    const nodes = [n("hub", 5), n("mid", 2), n("leaf", 0)];
    const edges = [
      { from: "hub", to: "mid" },
      { from: "mid", to: "leaf" },
    ];
    const r = capByDegree(nodes, edges, 2);
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(3);
    expect(r.nodes.map((x) => x.path).sort()).toEqual(["hub", "mid"]);
    expect(r.edges).toEqual([{ from: "hub", to: "mid" }]); // mid→leaf dropped
  });
});
