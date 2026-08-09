import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemporalScrubber } from "./TemporalScrubber";
import type { Revision } from "../../contract";

const tl: Revision[] = [
  { id: "c3", message: "third", timestamp_secs: 30n, author: "a" },
  { id: "c2", message: "second", timestamp_secs: 20n, author: "a" },
  { id: "c1", message: "first", timestamp_secs: 10n, author: "a" },
];

function renderScrubber(overrides = {}) {
  const props = {
    timeline: tl,
    selection: { kind: "live" } as const,
    onSelect: vi.fn(),
    counts: { notes: 3, links: 2 },
    delta: null,
    ...overrides,
  };
  render(<TemporalScrubber {...props} />);
  return props;
}

describe("TemporalScrubber", () => {
  it("renders Live, Browse and Compare controls", () => {
    renderScrubber();
    expect(screen.getByRole("button", { name: /live/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^browse$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^compare$/i }),
    ).toBeInTheDocument();
  });

  it("Browse: moving to the leftmost position selects the oldest snapshot", () => {
    const { onSelect } = renderScrubber();
    // leftmost display index 0 = oldest (c1) → timeline index 2
    fireEvent.change(screen.getByLabelText(/timeline position/i), {
      target: { value: "0" },
    });
    expect(onSelect).toHaveBeenCalledWith({ kind: "snapshot", at: 2 });
  });

  it("Compare: setting from=oldest and to=newest emits a compare selection", async () => {
    const { onSelect } = renderScrubber();
    await userEvent.click(screen.getByRole("button", { name: /^compare$/i }));
    fireEvent.change(screen.getByLabelText(/compare from/i), {
      target: { value: "0" }, // oldest → tl index 2
    });
    fireEvent.change(screen.getByLabelText(/compare to/i), {
      target: { value: "2" }, // newest → tl index 0
    });
    expect(onSelect).toHaveBeenLastCalledWith({
      kind: "compare",
      from: 2,
      to: 0,
    });
  });

  it("banner shows the snapshot date + message for a snapshot selection", () => {
    renderScrubber({ selection: { kind: "snapshot", at: 2 } }); // c1 "first"
    expect(screen.getByText(/viewing vault as of/i)).toBeInTheDocument();
    expect(screen.getByText(/first/)).toBeInTheDocument();
  });

  it("renders a long timeline without a per-revision DOM blowup", () => {
    const long: Revision[] = Array.from({ length: 120 }, (_, i) => ({
      id: `r${i}`,
      message: `m${i}`,
      timestamp_secs: BigInt(i),
      author: "a",
    }));
    renderScrubber({ timeline: long });
    // histogram is fixed-bucket; no 120 buttons
    expect(screen.getAllByRole("button").length).toBeLessThan(20);
  });
});
