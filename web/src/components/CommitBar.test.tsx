import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
        onRequestCommit={vi.fn()}
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
        onRequestCommit={vi.fn()}
      />,
    );
    expect(screen.getByText(/c0007/)).toBeInTheDocument();
  });

  it("requests a commit when 'Commit' is clicked", () => {
    const onRequestCommit = vi.fn();
    render(
      <CommitBar
        saving={false}
        dirty={false}
        uncommitted={true}
        lastCommit={null}
        committing={false}
        onRequestCommit={onRequestCommit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^commit$/i }));
    expect(onRequestCommit).toHaveBeenCalled();
  });
});
