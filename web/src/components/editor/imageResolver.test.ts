import { describe, it, expect, vi } from "vitest";
import { makeImageResolver } from "./imageResolver";

describe("makeImageResolver", () => {
  it("passes through http(s) URLs unchanged", () => {
    const r = makeImageResolver(vi.fn());
    expect(r("https://x/y.png")).toBe("https://x/y.png");
  });
  it("passes through data URLs unchanged", () => {
    const r = makeImageResolver(vi.fn());
    expect(r("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
  it("resolves local relative paths via assetUrl", () => {
    const assetUrl = vi.fn().mockReturnValue("asset://img/logo.png");
    const r = makeImageResolver(assetUrl);
    expect(r("img/logo.png")).toBe("asset://img/logo.png");
    expect(assetUrl).toHaveBeenCalledWith("img/logo.png");
  });
});
