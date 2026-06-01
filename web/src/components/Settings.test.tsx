import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "./Settings";
import { DEFAULT_SETTINGS } from "../store/store";

describe("Settings", () => {
  it("toggles idle auto-commit", async () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/idle auto-commit/i));
    expect(onChange).toHaveBeenCalledWith({
      idleAutoCommit: !DEFAULT_SETTINGS.idleAutoCommit,
    });
  });

  it("edits the interval minutes", async () => {
    const onChange = vi.fn();
    render(<Settings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    const input = screen.getByLabelText(/interval \(min\)/i);
    await userEvent.clear(input);
    await userEvent.type(input, "10");
    expect(onChange).toHaveBeenLastCalledWith({ intervalAutoCommitMin: 10 });
  });
});
