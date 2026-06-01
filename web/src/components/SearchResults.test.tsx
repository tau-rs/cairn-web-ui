import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResults } from "./SearchResults";

describe("SearchResults", () => {
  it("renders nothing when results are null", () => {
    const { container } = render(
      <SearchResults results={null} onOpen={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a result and can be closed", async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<SearchResults results={["b.md"]} onOpen={onOpen} onClose={onClose} />);
    await userEvent.click(screen.getByText("b.md"));
    expect(onOpen).toHaveBeenCalledWith("b.md");
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
