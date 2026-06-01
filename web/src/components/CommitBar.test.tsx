import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitBar } from "./CommitBar";

describe("CommitBar", () => {
  it("shows saving status", () => {
    render(
      <CommitBar saving dirty uncommitted={false} lastCommit={null} committing={false} onCommit={vi.fn()} />,
    );
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("shows last commit id when present", () => {
    render(
      <CommitBar saving={false} dirty={false} uncommitted={false} lastCommit="c0007" committing={false} onCommit={vi.fn()} />,
    );
    expect(screen.getByText(/c0007/)).toBeInTheDocument();
  });

  it("commits with the entered message", async () => {
    const onCommit = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("snapshot");
    render(
      <CommitBar saving={false} dirty={false} uncommitted onCommit={onCommit} lastCommit={null} committing={false} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /commit/i }));
    expect(onCommit).toHaveBeenCalledWith("snapshot");
  });
});
