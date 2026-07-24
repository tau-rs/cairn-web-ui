import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphView } from "./GraphView";
import { cairnStore } from "../app/cairnStore";
import type { GraphNode, Revision } from "../contract";

const gnode = (p: string): GraphNode => ({
  path: p,
  title: p,
  degree: 0,
  tags: [],
  mtime_secs: 0,
});
const TL: Revision[] = [
  { id: "r2", message: "add b", timestamp_secs: 20n, author: "x" },
  { id: "r1", message: "init", timestamp_secs: 10n, author: "x" },
];

// react-force-graph-2d only mounts once the container has a measured size,
// which it never does in jsdom, so these tests exercise the chrome (overlay,
// controls) without the canvas.
function setup(over = {}) {
  const props = {
    nodes: [] as GraphNode[],
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

  it("shows the cap banner when the global graph exceeds the node cap", () => {
    // 1501 > GLOBAL_NODE_CAP (1500) → capByDegree truncates in the global view.
    const many = Array.from({ length: 1501 }, (_, i) => gnode(`n${i}.md`));
    setup({ nodes: many, edges: [] });
    expect(
      screen.getByText(/most-connected of 1501 notes/i),
    ).toBeInTheDocument();
  });

  it("shows no cap banner under the node cap", () => {
    setup({ nodes: [gnode("a.md"), gnode("b.md")], edges: [] });
    expect(screen.queryByText(/most-connected of/i)).toBeNull();
  });

  it("disables the temporal toggle when no note is open", () => {
    vi.spyOn(cairnStore.getState(), "loadTimeline").mockResolvedValue();
    setup({ nodes: [gnode("a.md")], activePath: null });
    expect(
      screen.getByRole("button", { name: /graph history/i }),
    ).toBeDisabled();
  });

  it("shows the scrubber when temporal is opened with a note active", async () => {
    vi.spyOn(cairnStore.getState(), "loadTimeline").mockResolvedValue();
    vi.spyOn(cairnStore.getState(), "clearTemporal").mockImplementation(
      () => {},
    );
    cairnStore.setState({
      temporal: { timeline: TL, snapshot: null, diff: null },
    });
    setup({ nodes: [gnode("a.md")], activePath: "a.md" });
    await userEvent.click(
      screen.getByRole("button", { name: /graph history/i }),
    );
    expect(screen.getByRole("button", { name: /live/i })).toBeInTheDocument();
  });
});
