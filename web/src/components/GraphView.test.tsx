import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraphView } from "./GraphView";

// react-force-graph-2d only mounts once the container has a measured size,
// which it never does in jsdom, so these tests exercise the chrome (overlay,
// controls) without the canvas.
function setup(over = {}) {
  const props = {
    nodes: [] as string[],
    edges: [] as { from: string; to: string }[],
    tagsByNote: {} as Record<string, string[]>,
    activePath: null as string | null,
    onOpenNote: vi.fn(),
    ...over,
  };
  render(<GraphView {...props} />);
  return props;
}

describe("GraphView", () => {
  it("shows a loading overlay while the graph loads", () => {
    setup({ loading: true });
    expect(
      screen.getByRole("status", { name: /loading graph/i }),
    ).toBeInTheDocument();
  });
  it("shows no loading overlay when not loading", () => {
    setup({ loading: false });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
