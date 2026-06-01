import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitBar } from "./CommitBar";

describe("CommitBar", () => {
  it("shows saving status", () => {
    render(
      <CommitBar
        saving
        dirty
        uncommitted={false}
        lastCommit={null}
        committing={false}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("shows last commit id when present", () => {
    render(
      <CommitBar
        saving={false}
        dirty={false}
        uncommitted={false}
        lastCommit="c0007"
        committing={false}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText(/c0007/)).toBeInTheDocument();
  });

  it("opens the commit dialog and commits the message", async () => {
    const onCommit = vi.fn();
    render(
      <CommitBar
        saving={false}
        dirty={false}
        uncommitted
        lastCommit={null}
        committing={false}
        onCommit={onCommit}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Commit" })); // trigger
    await userEvent.type(
      screen.getByPlaceholderText("Describe this change"),
      "snapshot",
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Commit" }),
    );
    expect(onCommit).toHaveBeenCalledWith("snapshot");
  });
});
