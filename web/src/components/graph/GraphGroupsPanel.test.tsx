import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphGroupsPanel } from "./GraphGroupsPanel";
import type { ColorGroup } from "./colorGroups";

const groups: ColorGroup[] = [
  { kind: "path", query: "projects", color: "#6366f1" },
];

describe("GraphGroupsPanel", () => {
  it("renders a row per group (kind, query, color)", () => {
    render(<GraphGroupsPanel groups={groups} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("projects")).toBeInTheDocument();
    expect(screen.getByLabelText("Group kind")).toHaveValue("path");
  });
  it("Add group appends a default group", () => {
    const onChange = vi.fn();
    render(<GraphGroupsPanel groups={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add group/i }));
    expect(onChange).toHaveBeenCalledWith([
      { kind: "path", query: "", color: "#6366f1" },
    ]);
  });
  it("editing the query fires onChange for that row", () => {
    const onChange = vi.fn();
    render(<GraphGroupsPanel groups={groups} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Group query"), {
      target: { value: "journal" },
    });
    expect(onChange).toHaveBeenCalledWith([
      { kind: "path", query: "journal", color: "#6366f1" },
    ]);
  });
  it("changing the kind fires onChange", () => {
    const onChange = vi.fn();
    render(<GraphGroupsPanel groups={groups} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Group kind"), {
      target: { value: "tag" },
    });
    expect(onChange).toHaveBeenCalledWith([
      { kind: "tag", query: "projects", color: "#6366f1" },
    ]);
  });
  it("remove drops the row", () => {
    const onChange = vi.fn();
    render(<GraphGroupsPanel groups={groups} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove group/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
