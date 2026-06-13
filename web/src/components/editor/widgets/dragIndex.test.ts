import { describe, it, expect } from "vitest";
import { dropIndex } from "./dragIndex";

describe("dropIndex", () => {
  const centers = [10, 30, 50];
  it("returns 0 before the first center", () => {
    expect(dropIndex(5, centers)).toBe(0);
  });
  it("returns the index past centers the pointer has crossed", () => {
    expect(dropIndex(35, centers)).toBe(2);
  });
  it("returns length past the last center", () => {
    expect(dropIndex(99, centers)).toBe(3);
  });
});
