import { describe, it, expect } from "vitest";
import { buildFlowElements } from "./buildFlowElements";

const positions = new Map([
  ["a.md", { x: 0, y: 0 }],
  ["dir/b.md", { x: 10, y: 20 }],
]);

describe("buildFlowElements", () => {
  it("maps notes to nodes with stem labels and an active flag", () => {
    const { nodes } = buildFlowElements(
      ["a.md", "dir/b.md"],
      [],
      positions,
      "a.md",
    );
    expect(nodes).toHaveLength(2);
    const a = nodes.find((n) => n.id === "a.md")!;
    const b = nodes.find((n) => n.id === "dir/b.md")!;
    expect(a.data.label).toBe("a");
    expect(b.data.label).toBe("b"); // stem strips dir + .md
    expect(a.position).toEqual({ x: 0, y: 0 });
    expect(a.data.active).toBe(true);
    expect(b.data.active).toBe(false);
  });

  it("maps edges to React Flow edges with source/target/id", () => {
    const { edges } = buildFlowElements(
      ["a.md", "dir/b.md"],
      [{ from: "a.md", to: "dir/b.md" }],
      positions,
      null,
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "a.md->dir/b.md",
      source: "a.md",
      target: "dir/b.md",
    });
  });
});
