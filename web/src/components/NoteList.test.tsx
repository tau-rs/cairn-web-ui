import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
        onNew={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("b.md"));
    expect(onOpen).toHaveBeenCalledWith("b.md");
  });

  it("calls onNew with a path from the prompt", async () => {
    const onNew = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("new.md");
    render(
      <NoteList
        paths={[]}
        activePath={null}
        onOpen={vi.fn()}
        onNew={onNew}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /new note/i }));
    expect(onNew).toHaveBeenCalledWith("new.md");
  });

  it("calls onDelete for a note", async () => {
    const onDelete = vi.fn();
    render(
      <NoteList
        paths={["a.md"]}
        activePath={null}
        onOpen={vi.fn()}
        onNew={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /delete a\.md/i }),
    );
    expect(onDelete).toHaveBeenCalledWith("a.md");
  });
});
