import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TreeContextMenu } from "./TreeContextMenu";

function setup(overrides = {}) {
  const handlers = {
    x: 10,
    y: 10,
    onOpen: vi.fn(),
    onOpenToSide: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TreeContextMenu {...handlers} />);
  return handlers;
}

describe("TreeContextMenu", () => {
  it("renders the four items", () => {
    setup();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Open to the side")).toBeInTheDocument();
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("fires Open to the side then closes", () => {
    const h = setup();
    fireEvent.click(screen.getByText("Open to the side"));
    expect(h.onOpenToSide).toHaveBeenCalled();
    expect(h.onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const h = setup();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(h.onClose).toHaveBeenCalled();
  });
});
