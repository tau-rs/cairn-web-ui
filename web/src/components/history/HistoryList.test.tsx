import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryList } from "./HistoryList";
import type { Revision } from "../../contract";

const REVS: Revision[] = [
  { id: "r2", message: "second", timestamp_secs: 2n, author: "tau" },
  { id: "r1", message: "first", timestamp_secs: 1n, author: "tau" },
];

describe("HistoryList", () => {
  it("shows a loading state", () => {
    render(
      <HistoryList
        revisions={null}
        loading
        onView={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
  it("shows an empty state", () => {
    render(
      <HistoryList
        revisions={[]}
        loading={false}
        onView={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByText(/No history/i)).toBeInTheDocument();
  });
  it("renders one row per revision with message + short hash", () => {
    render(
      <HistoryList
        revisions={REVS}
        loading={false}
        onView={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText(/r2/)).toBeInTheDocument();
  });
  it("fires onView and onRestore with the revision id", () => {
    const onView = vi.fn();
    const onRestore = vi.fn();
    render(
      <HistoryList
        revisions={REVS}
        loading={false}
        onView={onView}
        onRestore={onRestore}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /view/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /restore/i })[0]);
    expect(onView).toHaveBeenCalledWith("r2");
    expect(onRestore).toHaveBeenCalledWith("r2");
  });
});
