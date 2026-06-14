import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevisionView } from "./RevisionView";

const base = {
  revision: "r1",
  contents: "a\nb",
  current: "a\nc",
  onBack: vi.fn(),
  onRestore: vi.fn(),
};

describe("RevisionView", () => {
  it("keeps the read-only banner with the revision", () => {
    render(<RevisionView {...base} />);
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.getByText(/r1/)).toBeInTheDocument();
  });

  it("renders a diff by default with add and del markers", () => {
    render(<RevisionView {...base} />);
    // old "a\nb" -> new "a\nc": b removed, c added.
    expect(screen.getByText("c")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("switches to full mode showing raw revision contents without markers", () => {
    const { container } = render(<RevisionView {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Full" }));
    expect(screen.queryByText("+")).not.toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    // Full mode renders raw contents in a <pre>.
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe("a\nb");
  });

  it("switches back to diff mode", () => {
    render(<RevisionView {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Full" }));
    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("fires onBack and onRestore from the diff view", () => {
    const onBack = vi.fn();
    const onRestore = vi.fn();
    render(<RevisionView {...base} onBack={onBack} onRestore={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: /back to current/i }));
    fireEvent.click(screen.getByRole("button", { name: /restore/i }));
    expect(onBack).toHaveBeenCalled();
    expect(onRestore).toHaveBeenCalled();
  });
});
