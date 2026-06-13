import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { cairnStore } from "../../app/cairnStore";
import { MobileShell } from "./MobileShell";

const regions = {
  topBar: <div>TOPBAR</div>,
  list: <div>LIST</div>,
  editor: <div>EDITOR</div>,
  backlinks: <div>BACKLINKS</div>,
};

function renderShell() {
  return render(
    <MemoryRouter>
      <MobileShell {...regions} />
    </MemoryRouter>,
  );
}

describe("MobileShell", () => {
  beforeEach(() => {
    cairnStore.getState().setUi({ mobileTab: "editor", backlinksOpen: false });
  });

  it("shows the editor by default and the bottom nav", () => {
    renderShell();
    expect(screen.getByText("EDITOR")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("switches to the Files view when the Files tab is tapped", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(screen.getByText("LIST")).toBeInTheDocument();
    expect(screen.queryByText("EDITOR")).not.toBeInTheDocument();
  });

  it("switches to the More view when the More tab is tapped", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(
      screen.getByRole("button", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("opens the backlinks bottom sheet from the header", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: /backlinks/i }));
    expect(screen.getByText("BACKLINKS")).toBeInTheDocument();
  });

  it("leaves the Files tab and shows the editor when a note route is active", () => {
    cairnStore.getState().setUi({ mobileTab: "files" });
    render(
      <MemoryRouter initialEntries={["/note/a.md"]}>
        <MobileShell {...regions} />
      </MemoryRouter>,
    );
    expect(screen.getByText("EDITOR")).toBeInTheDocument();
    expect(screen.queryByText("LIST")).not.toBeInTheDocument();
  });
});
