import { describe, it, expect } from "vitest";
import { toPaletteCommands, parsePluginCommandId } from "./pluginCommands";

const demo = {
  id: "demo",
  name: "Demo plugin",
  version: "1.0.0",
  commands: [{ id: "stamp", title: "Insert stamp note" }],
};

describe("toPaletteCommands", () => {
  it("flattens plugins' commands into palette commands", () => {
    expect(toPaletteCommands([demo])).toEqual([
      { id: "plugin:demo/stamp", label: "Demo plugin: Insert stamp note" },
    ]);
  });
  it("returns [] for no plugins", () => {
    expect(toPaletteCommands([])).toEqual([]);
  });
});

describe("parsePluginCommandId", () => {
  it("round-trips a plugin command id", () => {
    expect(parsePluginCommandId("plugin:demo/stamp")).toEqual({
      plugin: "demo",
      command: "stamp",
    });
  });
  it("keeps a slash in the command id", () => {
    expect(parsePluginCommandId("plugin:demo/sub/run")).toEqual({
      plugin: "demo",
      command: "sub/run",
    });
  });
  it("returns null for a non-plugin id", () => {
    expect(parsePluginCommandId("new-note")).toBeNull();
    expect(parsePluginCommandId("plugin:demo")).toBeNull();
  });
});
