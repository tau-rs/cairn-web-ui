import { describe, it, expect } from "vitest";
import {
  assertEvent,
  assertCommandResponse,
  assertQueryResponse,
  ContractShapeError,
} from "./contractGuards";

describe("contractGuards", () => {
  it("passes a known-tag event through unchanged", () => {
    const e = { type: "committed", commit: "c1" };
    expect(assertEvent(e)).toBe(e);
  });
  it("passes known-tag command/query responses through", () => {
    const c = { type: "done" };
    const q = { type: "paths", paths: ["a.md"] };
    expect(assertCommandResponse(c)).toBe(c);
    expect(assertQueryResponse(q)).toBe(q);
  });
  it("rejects an unknown tag with a clear ContractShapeError", () => {
    expect(() => assertEvent({ type: "bogus" })).toThrow(ContractShapeError);
    expect(() => assertEvent({ type: "bogus" })).toThrow(/event/);
    expect(() => assertEvent({ type: "bogus" })).toThrow(/bogus/);
  });
  it("rejects a missing/invalid type, null, and non-objects", () => {
    expect(() => assertCommandResponse({})).toThrow(ContractShapeError);
    expect(() => assertQueryResponse(null)).toThrow(ContractShapeError);
    expect(() => assertEvent("nope")).toThrow(ContractShapeError);
    expect(() => assertEvent({ type: 5 })).toThrow(ContractShapeError);
  });
});
