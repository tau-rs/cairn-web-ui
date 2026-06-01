import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { makeBackend } from "./makeBackend";
import { MockClient } from "../client/mock";
import { MockHost } from "../client/host";

describe("makeBackend", () => {
  it("returns the mock backend when not under Tauri", () => {
    const { client, host } = makeBackend();
    expect(client).toBeInstanceOf(MockClient);
    expect(host).toBeInstanceOf(MockHost);
  });
});
