import { describe, it, expect } from "vitest";
import { computeGraphLayout } from "./computeLayout";

describe("computeGraphLayout", () => {
  it("returns a finite position for every node, including isolated ones", () => {
    const nodes = ["a.md", "b.md", "c.md"]; // c.md has no links
    const edges = [{ from: "a.md", to: "b.md" }];
    const pos = computeGraphLayout(nodes, edges);
    expect(pos.size).toBe(3);
    for (const id of nodes) {
      const p = pos.get(id);
      expect(p).toBeDefined();
      expect(Number.isFinite(p!.x)).toBe(true);
      expect(Number.isFinite(p!.y)).toBe(true);
    }
  });

  it("ignores edges whose endpoints are not in the node set", () => {
    const pos = computeGraphLayout(
      ["a.md"],
      [{ from: "a.md", to: "ghost.md" }],
    );
    expect(pos.size).toBe(1);
    expect(Number.isFinite(pos.get("a.md")!.x)).toBe(true);
  });
});
