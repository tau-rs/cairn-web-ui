import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabStrip } from "./TabStrip";

const tabs = [
  { path: "a.md", preview: false, dirty: false },
  { path: "ideas.md", preview: true, dirty: true },
];

function setup(over = {}) {
  const props = {
    tabs,
    activePath: "a.md",
    onSelect: vi.fn(),
    onPin: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<TabStrip {...props} />);
  return props;
}

describe("TabStrip", () => {
  it("renders a tab per open note with the stem label", () => {
    setup();
    expect(screen.getByRole("tab", { name: /a$/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ideas/ })).toBeInTheDocument();
  });
  it("marks the active tab as selected", () => {
    setup();
    expect(screen.getByRole("tab", { name: /a$/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("calls onSelect when a tab is clicked", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("tab", { name: /ideas/ }));
    expect(props.onSelect).toHaveBeenCalledWith("ideas.md");
  });
  it("calls onPin on double-click", () => {
    const props = setup();
    fireEvent.doubleClick(screen.getByRole("tab", { name: /ideas/ }));
    expect(props.onPin).toHaveBeenCalledWith("ideas.md");
  });
  it("calls onClose (not onSelect) when the × is clicked", () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText("close ideas"));
    expect(props.onClose).toHaveBeenCalledWith("ideas.md");
    expect(props.onSelect).not.toHaveBeenCalled();
  });
  it("renders nothing when there are no tabs", () => {
    const { container } = render(
      <TabStrip
        tabs={[]}
        activePath={null}
        onSelect={vi.fn()}
        onPin={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});
