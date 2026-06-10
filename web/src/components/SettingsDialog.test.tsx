import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "./SettingsDialog";
import { DEFAULT_SETTINGS } from "../store/store";

describe("SettingsDialog", () => {
  it("renders the auto-commit controls and Done closes", async () => {
    const onOpenChange = vi.fn();
    render(
      <SettingsDialog
        open
        onOpenChange={onOpenChange}
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        keybindingOverrides={{}}
        onKeybindingsChange={vi.fn()}
        plugins={[]}
      />,
    );
    expect(screen.getByText(/idle auto-commit/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
