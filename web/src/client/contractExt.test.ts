import { describe, it, expect } from "vitest";
import { asCommand, type CommandEx, type RevisionEx } from "./contractExt";
import type { Revision } from "../contract/Revision";

describe("contractExt", () => {
  it("asCommand passes C0 commands through the vendored Command seam", () => {
    const seal: CommandEx = { type: "commit" };
    const name: CommandEx = { type: "name_version", commit: "c0001", name: "Draft 1" };
    expect(asCommand(seal)).toEqual({ type: "commit" });
    expect(asCommand(name)).toEqual({ type: "name_version", commit: "c0001", name: "Draft 1" });
  });

  it("RevisionEx is assignable from a plain vendored Revision", () => {
    const plain: Revision = { id: "c1", message: "m", timestamp_secs: 1, author: "a" };
    const ex: RevisionEx = plain; // pre-C0 daemons omit every new field
    expect(ex.is_named).toBeUndefined();
  });
});
