import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollabPresencePill } from "./CollabPresencePill";

const base = {
  note: "n.md",
  live: false,
  pendingCount: 0,
  peers: [],
  theirs: null,
};

describe("CollabPresencePill", () => {
  it("renders nothing when quiet", () => {
    const { container } = render(
      <CollabPresencePill collab={base} dirty={false} onReload={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the binary label when live and buffer clean", () => {
    render(
      <CollabPresencePill
        collab={{ ...base, live: true }}
        dirty={false}
        onReload={() => {}}
      />,
    );
    expect(screen.getByText("Live edits")).toBeInTheDocument();
  });

  it("shows the reload nudge when live + dirty + pending, and fires onReload", async () => {
    const onReload = vi.fn();
    render(
      <CollabPresencePill
        collab={{ ...base, live: true, pendingCount: 3 }}
        dirty={true}
        onReload={onReload}
      />,
    );
    expect(screen.getByText(/3 live changes/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /reload/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("shows the binary pill (not the nudge) when live + clean + stale pendingCount", () => {
    render(
      <CollabPresencePill
        collab={{ ...base, live: true, pendingCount: 3 }}
        dirty={false}
        onReload={() => {}}
      />,
    );
    expect(screen.getByText("Live edits")).toBeInTheDocument();
    expect(screen.queryByText(/live changes/i)).not.toBeInTheDocument();
  });

  it("shows the binary pill (not the nudge) when live + dirty + pendingCount is 0", () => {
    render(
      <CollabPresencePill
        collab={{ ...base, live: true, pendingCount: 0 }}
        dirty={true}
        onReload={() => {}}
      />,
    );
    expect(screen.getByText("Live edits")).toBeInTheDocument();
    expect(screen.queryByText(/live changes/i)).not.toBeInTheDocument();
  });

  it("the reload nudge persists past live-decay (live=false, dirty+pending)", () => {
    render(
      <CollabPresencePill
        collab={{ ...base, live: false, pendingCount: 2 }}
        dirty={true}
        onReload={() => {}}
      />,
    );
    expect(screen.getByText(/2 live changes/i)).toBeInTheDocument();
  });
});
