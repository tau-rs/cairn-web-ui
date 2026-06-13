import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import { EditorPane } from "./EditorPane";
import { cairnStore } from "../app/cairnStore";

function seedSplit() {
  cairnStore.setState({
    notePaths: ["a.md", "b.md"],
    openNotes: {
      "a.md": { contents: "alpha", dirty: false, saving: false },
      "b.md": { contents: "beta", dirty: false, saving: false },
    },
    panes: [
      { tabs: [{ path: "a.md", preview: false }], activePath: "a.md" },
      { tabs: [{ path: "b.md", preview: false }], activePath: "b.md" },
    ],
    activePane: 1,
    splitRatio: 0.5,
    activePath: "b.md",
    activeContents: "beta",
  });
}

describe("EditorPane split", () => {
  beforeEach(() => seedSplit());

  it("renders both panes' tab strips and a resize separator", () => {
    render(
      <MemoryRouter initialEntries={["/note/b.md"]}>
        <EditorPane />
      </MemoryRouter>,
    );
    // stem("a.md") === "a", stem("b.md") === "b" — TabStrip uses stem() for aria-label
    expect(screen.getByLabelText("a")).toBeInTheDocument();
    expect(screen.getByLabelText("b")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});
