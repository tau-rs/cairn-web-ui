import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CommitDialog } from "./CommitDialog";

describe("CommitDialog", () => {
  it("commits the typed message and closes", async () => {
    const onCommit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CommitDialog
        open
        committing={false}
        onOpenChange={onOpenChange}
        onCommit={onCommit}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText("Describe this change"),
      "msg",
    );
    await userEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(onCommit).toHaveBeenCalledWith("msg");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("disables Commit when empty or committing", () => {
    const { rerender } = render(
      <CommitDialog
        open
        committing={false}
        onOpenChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled(); // empty
    rerender(
      <CommitDialog
        open
        committing
        onOpenChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled(); // committing
  });
  it("resets the message field when cancelled and reopened", async () => {
    const onCommit = vi.fn();
    let externalSetOpen: (v: boolean) => void;
    function Wrapper() {
      const [open, setOpen] = useState(true);
      externalSetOpen = setOpen;
      return (
        <CommitDialog
          open={open}
          committing={false}
          onOpenChange={setOpen}
          onCommit={onCommit}
        />
      );
    }
    render(<Wrapper />);
    const input = screen.getByPlaceholderText("Describe this change");
    await userEvent.type(input, "wip message");
    expect(input).toHaveValue("wip message");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCommit).not.toHaveBeenCalled();
    // Reopen
    act(() => externalSetOpen(true));
    expect(screen.getByPlaceholderText("Describe this change")).toHaveValue("");
  });
});
