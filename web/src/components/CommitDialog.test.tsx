import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitDialog } from "./CommitDialog";

describe("CommitDialog", () => {
  it("commits the typed message and closes", async () => {
    const onCommit = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommitDialog open committing={false} onOpenChange={onOpenChange} onCommit={onCommit} />);
    await userEvent.type(screen.getByPlaceholderText("Describe this change"), "msg");
    await userEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(onCommit).toHaveBeenCalledWith("msg");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("disables Commit when empty or committing", () => {
    const { rerender } = render(
      <CommitDialog open committing={false} onOpenChange={vi.fn()} onCommit={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled(); // empty
    rerender(<CommitDialog open committing onOpenChange={vi.fn()} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled(); // committing
  });
});
