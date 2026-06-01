import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("submits the query on Enter", async () => {
    const onSearch = vi.fn();
    render(<SearchBar value="" onChange={vi.fn()} onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, "target{enter}");
    expect(onSearch).toHaveBeenCalledWith("target");
  });
});
