import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemporalScrubber } from "./TemporalScrubber";
import type { Revision } from "../../contract";

const tl: Revision[] = [
  { id: "c3", message: "third", timestamp_secs: 30n, author: "a" },
  { id: "c2", message: "second", timestamp_secs: 20n, author: "a" },
  { id: "c1", message: "first", timestamp_secs: 10n, author: "a" },
];

describe("TemporalScrubber", () => {
  it("renders one tick per revision plus a Live control", () => {
    render(
      <TemporalScrubber
        timeline={tl}
        selection={{ kind: "live" }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /revision/i })).toHaveLength(
      3,
    );
    expect(screen.getByRole("button", { name: /live/i })).toBeInTheDocument();
  });

  it("emits a snapshot selection with the newest-first index on tick click", async () => {
    const onSelect = vi.fn();
    render(
      <TemporalScrubber
        timeline={tl}
        selection={{ kind: "live" }}
        onSelect={onSelect}
      />,
    );
    // leftmost tick is the oldest (c1) → timeline index 2
    await userEvent.click(
      screen.getByRole("button", { name: /revision first/i }),
    );
    expect(onSelect).toHaveBeenCalledWith({ kind: "snapshot", at: 2 });
  });

  it("emits live from the Live control", async () => {
    const onSelect = vi.fn();
    render(
      <TemporalScrubber
        timeline={tl}
        selection={{ kind: "snapshot", at: 1 }}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /live/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "live" });
  });

  it("forms a compare range (older=from, newer=to) on a second tick", async () => {
    const onSelect = vi.fn();
    // snapshot at c2 (index 1) already active; click the oldest tick c1 (index 2)
    render(
      <TemporalScrubber
        timeline={tl}
        selection={{ kind: "snapshot", at: 1 }}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /revision first/i }),
    );
    expect(onSelect).toHaveBeenCalledWith({ kind: "compare", from: 2, to: 1 });
  });
});
