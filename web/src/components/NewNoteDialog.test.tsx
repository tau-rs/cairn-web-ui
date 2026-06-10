import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewNoteDialog } from "./NewNoteDialog";

describe("NewNoteDialog", () => {
  it("seeds the input from initialPath when opened", () => {
    render(
      <NewNoteDialog
        open={true}
        initialPath="projects/"
        onOpenChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("notes/idea.md")).toHaveValue(
      "projects/",
    );
  });
  it("creates the typed path and closes", () => {
    const onCreate = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <NewNoteDialog
        open={true}
        onOpenChange={onOpenChange}
        onCreate={onCreate}
      />,
    );
    const input = screen.getByPlaceholderText("notes/idea.md");
    fireEvent.change(input, { target: { value: "fresh.md" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledWith("fresh.md");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
