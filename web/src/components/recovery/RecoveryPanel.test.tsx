import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecoveryPanel } from "./RecoveryPanel";
import type { WireRecoverableBlock } from "../../contract";

const tombstoned = {
  id: { replica: 1, counter: 1 },
  tombstoned: true,
  versions: ["## Risks\n- lock-in"],
} as unknown as WireRecoverableBlock;

const live = {
  id: { replica: 2, counter: 5 },
  tombstoned: false,
  versions: ["old text"],
} as unknown as WireRecoverableBlock;

function baseProps() {
  return {
    open: true,
    note: "Plan",
    status: "ready" as const,
    blocks: [] as WireRecoverableBlock[],
    error: null,
    restoring: null,
    currentText: "current",
    restoreEnabled: true,
    onCopy: vi.fn(),
    onRestore: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("RecoveryPanel", () => {
  it("groups mixed blocks under Deleted/Overwritten count headers and renders versions", () => {
    render(<RecoveryPanel {...baseProps()} blocks={[tombstoned, live]} />);
    expect(screen.getByText("Deleted (1)")).toBeInTheDocument();
    expect(screen.getByText("Overwritten (1)")).toBeInTheDocument();
    expect(screen.getByText(/lock-in/)).toBeInTheDocument();
    expect(screen.getByText(/old text/)).toBeInTheDocument();
  });

  it("shows empty state when there are no recoverable blocks", () => {
    render(<RecoveryPanel {...baseProps()} blocks={[]} />);
    expect(
      screen.getByText("No recoverable content for this note."),
    ).toBeInTheDocument();
  });

  it("shows error text when status is error", () => {
    render(
      <RecoveryPanel
        {...baseProps()}
        status="error"
        error="boom"
        blocks={[]}
      />,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <RecoveryPanel {...baseProps()} open={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
