import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevisionView } from "./RevisionView";

describe("RevisionView", () => {
  it("shows a read-only banner with the revision and the contents", () => {
    render(<RevisionView revision="r1" contents="old body" onBack={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.getByText(/r1/)).toBeInTheDocument();
    expect(screen.getByText("old body")).toBeInTheDocument();
  });
  it("fires onBack and onRestore", () => {
    const onBack = vi.fn();
    const onRestore = vi.fn();
    render(<RevisionView revision="r1" contents="old" onBack={onBack} onRestore={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: /back to current/i }));
    fireEvent.click(screen.getByRole("button", { name: /restore/i }));
    expect(onBack).toHaveBeenCalled();
    expect(onRestore).toHaveBeenCalled();
  });
});
