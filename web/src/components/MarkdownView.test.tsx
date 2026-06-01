import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownView } from "./MarkdownView";

describe("MarkdownView", () => {
  it("renders GFM markdown as HTML", () => {
    render(
      <MarkdownView contents={"# Title\n\n- a\n- b"} notePaths={[]} onOpenNote={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders a resolved [[wikilink]] that opens the note on click", async () => {
    const onOpenNote = vi.fn();
    render(
      <MarkdownView contents={"see [[ideas]] here"} notePaths={["ideas.md"]} onOpenNote={onOpenNote} />,
    );
    await userEvent.click(screen.getByText("ideas"));
    expect(onOpenNote).toHaveBeenCalledWith("ideas.md");
  });

  it("renders an unresolved [[wikilink]] without opening anything", async () => {
    const onOpenNote = vi.fn();
    render(
      <MarkdownView contents={"see [[missing]]"} notePaths={["ideas.md"]} onOpenNote={onOpenNote} />,
    );
    await userEvent.click(screen.getByText("missing"));
    expect(onOpenNote).not.toHaveBeenCalled();
  });
});
