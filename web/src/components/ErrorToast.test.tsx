import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorToast } from "./ErrorToast";

describe("ErrorToast", () => {
  it("renders nothing when message is null", () => {
    const { container } = render(<ErrorToast message={null} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message and dismisses", async () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="boom" onDismiss={onDismiss} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
