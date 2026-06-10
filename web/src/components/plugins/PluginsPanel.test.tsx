import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PluginsPanel } from "./PluginsPanel";

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
});
