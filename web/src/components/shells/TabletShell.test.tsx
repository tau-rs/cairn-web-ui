import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cairnStore } from "../../app/cairnStore";
import { TabletShell } from "./TabletShell";

const regions = {
  topBar: <div>TOPBAR</div>,
  list: <div>LIST</div>,
  editor: <div>EDITOR</div>,
  backlinks: <div>BACKLINKS</div>,
};

describe("TabletShell", () => {
  beforeEach(() => {
    cairnStore.getState().setUi({ backlinksOpen: false });
  });

  it("shows tree + editor and hides backlinks until toggled", () => {
    render(<TabletShell {...regions} />);
    expect(screen.getByText("LIST")).toBeInTheDocument();
    expect(screen.getByText("EDITOR")).toBeInTheDocument();
    expect(screen.queryByText("BACKLINKS")).not.toBeInTheDocument();
  });

  it("opens the backlinks drawer via the Links button", async () => {
    render(<TabletShell {...regions} />);
    await userEvent.click(screen.getByRole("button", { name: /links/i }));
    expect(screen.getByText("BACKLINKS")).toBeInTheDocument();
  });
});
