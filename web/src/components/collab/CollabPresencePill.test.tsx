import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollabPresencePill } from "./CollabPresencePill";

const base = { note: "n.md", live: false, pendingCount: 0 };

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
});
