import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "./Editor";

describe("Editor", () => {
  it("shows a placeholder when no note is open", () => {
    render(<Editor path={null} value="" mode="raw" onChange={vi.fn()} onToggleMode={vi.fn()} />);
    expect(screen.getByText(/no note open/i)).toBeInTheDocument();
  });

  it("raw mode edits call onChange", async () => {
    const onChange = vi.fn();
    render(<Editor path="a.md" value="hi" mode="raw" onChange={onChange} onToggleMode={vi.fn()} />);
    const area = screen.getByRole("textbox");
    await userEvent.type(area, "!");
    expect(onChange).toHaveBeenCalled();
  });

  it("toggle button switches mode", async () => {
    const onToggleMode = vi.fn();
    render(
      <Editor path="a.md" value="hi" mode="raw" onChange={vi.fn()} onToggleMode={onToggleMode} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /rich|raw/i }));
    expect(onToggleMode).toHaveBeenCalled();
  });
});
