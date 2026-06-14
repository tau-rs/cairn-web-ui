import { describe, it, expect } from "vitest";
import { relativeTime, absoluteTime } from "./formatRevision";

// Fixed "now" so tests are deterministic.
const NOW = 1_700_000_000; // seconds

describe("relativeTime", () => {
  it("formats sub-minute as 'just now'", () => {
    expect(relativeTime(BigInt(NOW - 10), NOW)).toBe("just now");
  });
  it("formats minutes/hours/days", () => {
    expect(relativeTime(BigInt(NOW - 5 * 60), NOW)).toBe("5m ago");
    expect(relativeTime(BigInt(NOW - 3 * 3600), NOW)).toBe("3h ago");
    expect(relativeTime(BigInt(NOW - 2 * 86400), NOW)).toBe("2d ago");
  });
});

describe("absoluteTime", () => {
  it("renders a locale date-time string for the bigint seconds", () => {
    const out = absoluteTime(BigInt(NOW));
    expect(out).toBe(new Date(NOW * 1000).toLocaleString());
  });
});
