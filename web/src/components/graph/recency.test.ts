import { describe, it, expect } from "vitest";
import { recencyRing, DEFAULT_RECENCY } from "./recency";

describe("recencyRing", () => {
  const now = 1_000_000; // secs
  const DAY = 86_400;
  it("full ring when edited now", () => {
    expect(recencyRing(now, now, 30)).toEqual({ alpha: 1, width: 4 });
  });
  it("null when older than the window", () => {
    expect(recencyRing(now - 31 * DAY, now, 30)).toBeNull();
  });
  it("ramps down linearly across the window", () => {
    const mid = recencyRing(now - 15 * DAY, now, 30)!;
    expect(mid.alpha).toBeCloseTo(0.5, 1);
    expect(mid.width).toBeGreaterThan(1);
    expect(mid.width).toBeLessThan(4);
  });
  it("future/negative age clamps to full, not >1", () => {
    expect(recencyRing(now + DAY, now, 30)!.alpha).toBe(1);
  });
  it("DEFAULT_RECENCY is off, 30 days", () => {
    expect(DEFAULT_RECENCY).toEqual({ enabled: false, windowDays: 30 });
  });
});
