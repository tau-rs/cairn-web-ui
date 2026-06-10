import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteList } from "./NoteList";

describe("NoteList", () => {
  it("lists notes and fires onOpen when one is clicked", async () => {
    const onOpen = vi.fn();
    render(
      <NoteList
        paths={["a.md", "b.md"]}
        activePath="a.md"
        onOpen={onOpen}
        onRequestNew={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("b.md"));
    expect(onOpen).toHaveBeenCalledWith("b.md");
  });

  it("requests a new note when '+ New note' is clicked", () => {
    const onRequestNew = vi.fn();
    render(
      <NoteList
        paths={["a.md"]}
        activePath={null}
        onOpen={vi.fn()}
        onRequestNew={onRequestNew}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /new note/i }));
    expect(onRequestNew).toHaveBeenCalled();
  });

  it("calls onDelete for a note", async () => {
    const onDelete = vi.fn();
    render(
      <NoteList
        paths={["a.md"]}
        activePath={null}
        onOpen={vi.fn()}
        onRequestNew={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /delete a\.md/i }),
    );
    expect(onDelete).toHaveBeenCalledWith("a.md");
  });
});
