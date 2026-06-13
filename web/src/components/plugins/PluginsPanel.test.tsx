import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PluginsPanel } from "./PluginsPanel";

const sample = [
  {
    id: "demo",
    name: "Demo plugin",
    version: "1.0.0",
    commands: [{ id: "stamp", title: "Insert stamp note" }],
    contributions: [],
  },
];

describe("PluginsPanel", () => {
  it("lists each plugin's name/version and command titles", () => {
    render(
      <PluginsPanel
        plugins={[
          {
            id: "demo",
            name: "Demo plugin",
            version: "1.0.0",
            commands: [{ id: "stamp", title: "Insert stamp note" }],
            contributions: [],
          },
        ]}
      />,
    );
    expect(screen.getByText(/Demo plugin/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText("Insert stamp note")).toBeInTheDocument();
  });
  it("shows an empty state when there are no plugins", () => {
    render(<PluginsPanel plugins={[]} />);
    expect(screen.getByText(/no plugins loaded/i)).toBeInTheDocument();
  });
  it("surfaces a not-rendered line when contributions were dropped", () => {
    render(<PluginsPanel plugins={sample} dropped={3} />);
    expect(screen.getByText(/3 .*not rendered/i)).toBeInTheDocument();
  });
  it("renders no not-rendered line when dropped is 0", () => {
    render(<PluginsPanel plugins={sample} dropped={0} />);
    expect(screen.queryByText(/not rendered/i)).toBeNull();
  });
});
