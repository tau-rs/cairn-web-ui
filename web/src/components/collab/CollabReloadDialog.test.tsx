import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollabReloadDialog } from "./CollabReloadDialog";

describe("CollabReloadDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <CollabReloadDialog
        open={false}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText(/discard/i)).not.toBeInTheDocument();
  });

  it("warns about losing unsaved edits when open", () => {
    render(
      <CollabReloadDialog
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByText(/unsaved local edits will be lost/i),
    ).toBeInTheDocument();
  });

  it("confirming fires onConfirm once and closes", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CollabReloadDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /discard & reload/i }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancelling closes without reloading", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CollabReloadDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
