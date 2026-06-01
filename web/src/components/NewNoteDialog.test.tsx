import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewNoteDialog } from "./NewNoteDialog";

describe("NewNoteDialog", () => {
  it("creates from the typed path and closes", async () => {
    const onCreate = vi.fn();
    const onOpenChange = vi.fn();
    render(<NewNoteDialog open onOpenChange={onOpenChange} onCreate={onCreate} />);
    await userEvent.type(screen.getByPlaceholderText("notes/idea.md"), "a.md");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreate).toHaveBeenCalledWith("a.md");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("disables Create when empty", () => {
    render(<NewNoteDialog open onOpenChange={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });
  it("Cancel closes without creating", async () => {
    const onCreate = vi.fn();
    const onOpenChange = vi.fn();
    render(<NewNoteDialog open onOpenChange={onOpenChange} onCreate={onCreate} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
