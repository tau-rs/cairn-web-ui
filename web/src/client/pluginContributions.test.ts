import { describe, expect, it } from "vitest";
import {
  groupBySlot,
  sanitizeContributions,
  type SanitizeReport,
  type SlotEntry,
  PLUGIN_SLOTS,
  WIDGET_KINDS,
  MAX_CONTRIBS_PER_PLUGIN,
  MAX_LIST_ITEMS,
  MAX_STR,
} from "./pluginContributions";
import {
  PLUGIN_SLOT_VALUES,
  PLUGIN_WIDGET_KIND_VALUES,
  type PluginContribution,
  type PluginSummary,
} from "../contract";

function freshReport(): SanitizeReport {
  return { kept: 0, dropped: 0, reasons: [] };
}

describe("sanitizeContributions", () => {
  it("returns [] when input is not an array", () => {
    expect(sanitizeContributions(null)).toEqual([]);
    expect(sanitizeContributions({})).toEqual([]);
    expect(sanitizeContributions("nope")).toEqual([]);
  });

  it("keeps a well-formed text contribution with all null keys present", () => {
    const report = freshReport();
    const out = sanitizeContributions(
      [
        {
          id: "c1",
          slot: "sidebar.section",
          widget: { kind: "text", text: "hello" },
          title: "Title",
        },
      ],
      report,
    );
    expect(out).toEqual<PluginContribution[]>([
      {
        id: "c1",
        slot: "sidebar.section",
        widget: { kind: "text", text: "hello", muted: null },
        title: "Title",
        icon: null,
        order: null,
      },
    ]);
    expect(report.kept).toBe(1);
    expect(report.dropped).toBe(0);
  });

  it("emits a fully-populated action widget", () => {
    const out = sanitizeContributions([
      {
        id: "a1",
        slot: "topbar.action",
        widget: { kind: "action", label: "Go", command: "do.it" },
      },
    ]);
    expect(out[0].widget).toEqual({
      kind: "action",
      label: "Go",
      icon: null,
      command: "do.it",
      args: null,
    });
  });

  it("emits a fully-populated list widget", () => {
    const out = sanitizeContributions([
      {
        id: "l1",
        slot: "sidebar.section",
        widget: { kind: "list", items: [{ id: "i1", label: "Row" }] },
      },
    ]);
    expect(out[0].widget).toEqual({
      kind: "list",
      items: [
        { id: "i1", label: "Row", icon: null, command: null, args: null },
      ],
    });
  });

  it("drops an unknown slot", () => {
    const report = freshReport();
    const out = sanitizeContributions(
      [{ id: "x", slot: "bogus", widget: { kind: "text", text: "t" } }],
      report,
    );
    expect(out).toEqual([]);
    expect(report.dropped).toBe(1);
    expect(report.reasons.length).toBeGreaterThan(0);
  });

  it("drops an unknown widget kind", () => {
    const out = sanitizeContributions([
      { id: "x", slot: "command", widget: { kind: "iframe" } },
    ]);
    expect(out).toEqual([]);
  });

  it("drops a contribution missing a string id", () => {
    const out = sanitizeContributions([
      { slot: "sidebar.section", widget: { kind: "text", text: "t" } },
      { id: 7, slot: "sidebar.section", widget: { kind: "text", text: "t" } },
    ]);
    expect(out).toEqual([]);
  });

  it("drops a command-slot contribution whose widget is not action", () => {
    const out = sanitizeContributions([
      { id: "c", slot: "command", widget: { kind: "text", text: "t" } },
    ]);
    expect(out).toEqual([]);
  });

  it("keeps a command-slot contribution whose widget is action", () => {
    const out = sanitizeContributions([
      {
        id: "c",
        slot: "command",
        widget: { kind: "action", label: "Run", command: "run" },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].slot).toBe("command");
  });

  it("clamps over-long text to MAX_STR", () => {
    const big = "x".repeat(10000);
    const out = sanitizeContributions([
      { id: "c", slot: "sidebar.section", widget: { kind: "text", text: big } },
    ]);
    const w = out[0].widget;
    if (w.kind !== "text") throw new Error("expected text");
    expect(w.text).toHaveLength(MAX_STR);
  });

  it("clamps over-long title and label to MAX_STR", () => {
    const big = "y".repeat(9000);
    const out = sanitizeContributions([
      {
        id: "c",
        slot: "topbar.action",
        title: big,
        widget: { kind: "action", label: big, command: "cmd" },
      },
    ]);
    expect(out[0].title).toHaveLength(MAX_STR);
    const w = out[0].widget;
    if (w.kind !== "action") throw new Error("expected action");
    expect(w.label).toHaveLength(MAX_STR);
  });

  it("truncates a 10000-item list to MAX_LIST_ITEMS", () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({
      id: `i${i}`,
      label: `row ${i}`,
    }));
    const out = sanitizeContributions([
      { id: "c", slot: "sidebar.section", widget: { kind: "list", items } },
    ]);
    const w = out[0].widget;
    if (w.kind !== "list") throw new Error("expected list");
    expect(w.items).toHaveLength(MAX_LIST_ITEMS);
  });

  it("drops a contribution whose args exceeds MAX_ARGS_BYTES", () => {
    const report = freshReport();
    const huge = { blob: "z".repeat(20000) };
    const out = sanitizeContributions(
      [
        {
          id: "c",
          slot: "topbar.action",
          widget: { kind: "action", label: "L", command: "cmd", args: huge },
        },
      ],
      report,
    );
    expect(out).toEqual([]);
    expect(report.dropped).toBe(1);
  });

  it("caps a 1000-contribution array to MAX_CONTRIBS_PER_PLUGIN", () => {
    const raw = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${i}`,
      slot: "sidebar.section",
      widget: { kind: "text", text: "t" },
    }));
    const out = sanitizeContributions(raw);
    expect(out).toHaveLength(MAX_CONTRIBS_PER_PLUGIN);
  });

  it("coerces an out-of-enum icon to null", () => {
    const out = sanitizeContributions([
      {
        id: "c",
        slot: "sidebar.section",
        icon: "skull",
        widget: { kind: "text", text: "t" },
      },
    ]);
    expect(out[0].icon).toBeNull();
  });

  it("keeps a valid in-enum icon", () => {
    const out = sanitizeContributions([
      {
        id: "c",
        slot: "sidebar.section",
        icon: "star",
        widget: { kind: "text", text: "t" },
      },
    ]);
    expect(out[0].icon).toBe("star");
  });

  it("fills the SanitizeReport on drops", () => {
    const report = freshReport();
    sanitizeContributions(
      [
        {
          id: "ok",
          slot: "sidebar.section",
          widget: { kind: "text", text: "t" },
        },
        { id: "bad", slot: "nope", widget: { kind: "text", text: "t" } },
      ],
      report,
    );
    expect(report.kept).toBe(1);
    expect(report.dropped).toBeGreaterThan(0);
    expect(report.reasons.length).toBeGreaterThan(0);
  });
});

describe("allow-list lockstep with contract", () => {
  it("PLUGIN_SLOTS is a superset of PLUGIN_SLOT_VALUES", () => {
    for (const v of PLUGIN_SLOT_VALUES) {
      expect(PLUGIN_SLOTS).toContain(v);
    }
  });
  it("WIDGET_KINDS is a superset of PLUGIN_WIDGET_KIND_VALUES", () => {
    for (const v of PLUGIN_WIDGET_KIND_VALUES) {
      expect(WIDGET_KINDS).toContain(v);
    }
  });
});

describe("groupBySlot", () => {
  function plugin(id: string, contributions: unknown[]): PluginSummary {
    return {
      id,
      name: id,
      version: "1.0.0",
      commands: [],
      contributions: contributions as PluginContribution[],
    };
  }

  it("groups by slot and sorts by (order, plugin, id)", () => {
    const plugins = [
      plugin("zeta", [
        {
          id: "b",
          slot: "sidebar.section",
          order: 5,
          widget: { kind: "text", text: "t" },
        },
        {
          id: "a",
          slot: "sidebar.section",
          order: null,
          widget: { kind: "text", text: "t" },
        },
      ]),
      plugin("alpha", [
        {
          id: "a",
          slot: "sidebar.section",
          order: 5,
          widget: { kind: "text", text: "t" },
        },
        {
          id: "topbar",
          slot: "topbar.action",
          widget: { kind: "action", label: "L", command: "cmd" },
        },
      ]),
    ];
    const report = freshReport();
    const grouped = groupBySlot(plugins, 3, report);

    expect(Object.keys(grouped).sort()).toEqual([
      "sidebar.section",
      "topbar.action",
    ]);

    const sidebar = grouped["sidebar.section"];
    // order 5 first (alpha/a before zeta/b by plugin), then null-order zeta/a last.
    expect(sidebar.map((e: SlotEntry) => `${e.plugin}/${e.c.id}`)).toEqual([
      "alpha/a",
      "zeta/b",
      "zeta/a",
    ]);
    expect(sidebar[0].epoch).toBe(3);

    expect(grouped["topbar.action"]).toHaveLength(1);
    expect(report.kept).toBe(4);
  });
});
