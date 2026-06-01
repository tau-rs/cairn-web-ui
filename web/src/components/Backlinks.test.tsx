import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Backlinks } from "./Backlinks";

describe("Backlinks", () => {
  it("shows an empty state when there are none", () => {
    render(<Backlinks paths={[]} onOpen={vi.fn()} />);
    expect(screen.getByText(/no backlinks/i)).toBeInTheDocument();
  });

  it("lists backlinks and opens one on click", async () => {
    const onOpen = vi.fn();
    render(<Backlinks paths={["a.md"]} onOpen={onOpen} />);
    await userEvent.click(screen.getByText("a.md"));
    expect(onOpen).toHaveBeenCalledWith("a.md");
  });
});
