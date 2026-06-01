import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "./Editor";

const base = {
  path: "a.md" as string | null,
  value: "# Hi\n\nlink [[ideas]]",
  notePaths: ["ideas.md"],
  mode: "rendered" as "rendered" | "source",
  onChange: vi.fn(),
  onOpenNote: vi.fn(),
  onToggleMode: vi.fn(),
};

describe("Editor", () => {
  it("shows a placeholder when no note is open", () => {
    render(<Editor {...base} path={null} />);
    expect(screen.getByText(/no note open/i)).toBeInTheDocument();
  });

  it("rendered mode shows the rendered markdown (a heading), not a source editor", () => {
    render(<Editor {...base} mode="rendered" />);
    expect(screen.getByRole("heading", { name: "Hi" })).toBeInTheDocument();
  });

  it("the toggle button flips the mode", async () => {
    const onToggleMode = vi.fn();
    render(<Editor {...base} mode="rendered" onToggleMode={onToggleMode} />);
    await userEvent.click(screen.getByRole("button", { name: /edit source/i }));
    expect(onToggleMode).toHaveBeenCalled();
  });

  it("source mode renders the CodeMirror editor", () => {
    const { container } = render(<Editor {...base} mode="source" />);
    expect(container.querySelector(".cm-editor")).not.toBeNull();
  });
});
