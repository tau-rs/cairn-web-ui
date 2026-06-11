import { describe, it, expect, vi, afterEach } from "vitest";
import { installGlobalRejectionHandler } from "./globalErrorHandler";

describe("installGlobalRejectionHandler", () => {
  let dispose: (() => void) | null = null;
  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it("invokes the sink with the rejection reason", () => {
    const sink = vi.fn();
    dispose = installGlobalRejectionHandler(sink);
    const reason = new Error("escaped");
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(reason).catch(() => {}) as Promise<unknown>,
        reason,
      }),
    );
    expect(sink).toHaveBeenCalledWith(reason);
  });

  it("logs a structured diagnostic by default", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    dispose = installGlobalRejectionHandler();
    const reason = new Error("escaped");
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(reason).catch(() => {}) as Promise<unknown>,
        reason,
      }),
    );
    expect(spy).toHaveBeenCalledWith(
      "[cairn] unhandled promise rejection",
      expect.objectContaining({ error: reason }),
    );
    spy.mockRestore();
  });

  it("stops handling after dispose", () => {
    const sink = vi.fn();
    installGlobalRejectionHandler(sink)(); // install then immediately dispose
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject("x").catch(() => {}) as Promise<unknown>,
        reason: "x",
      }),
    );
    expect(sink).not.toHaveBeenCalled();
  });
});
