import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "./timer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("debounce", () => {
  it("invokes once after the delay, coalescing rapid calls", () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel() prevents a pending invocation", () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
