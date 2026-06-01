import { describe, it, expect } from "vitest";
import { alwaysOpenHost, MockHost } from "./host";

describe("alwaysOpenHost", () => {
  it("reports a cairn always open", async () => {
    expect(await alwaysOpenHost.currentCairn()).toBe("(fixture)");
    expect(await alwaysOpenHost.openCairn()).toBe("(fixture)");
  });
});

describe("MockHost", () => {
  it("behaves like the always-open host", async () => {
    const h = new MockHost();
    expect(await h.currentCairn()).toBe("(fixture)");
    expect(await h.openCairn()).toBe("(fixture)");
  });
});
