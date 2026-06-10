import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderTree } from "./FolderTreeView";

beforeEach(() => localStorage.clear());

function setup(over = {}) {
  const props = {
    paths: ["index.md", "notes/ideas.md", "notes/todo.md"],
    activePath: null as string | null,
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onRequestNew: vi.fn(),
    onRequestNewInFolder: vi.fn(),
    onApplyRenames: vi.fn(),
    ...over,
  };
  render(<FolderTree {...props} />);
  return props;
}

describe("FolderTree", () => {
  it("renders folders with nested notes, and root notes", () => {
    setup();
    expect(screen.getByRole("button", { name: "notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ideas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "index" })).toBeInTheDocument();
  });
  it("collapses and re-expands a folder", () => {
    setup();
    expect(screen.getByRole("button", { name: "ideas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "notes" }));
    expect(
      screen.queryByRole("button", { name: "ideas" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "notes" }));
    expect(screen.getByRole("button", { name: "ideas" })).toBeInTheDocument();
  });
  it("opens a note on click (full path)", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "ideas" }));
    expect(props.onOpen).toHaveBeenCalledWith("notes/ideas.md");
  });
  it("requests a new note in a folder via the folder +", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "new note in notes" }));
    expect(props.onRequestNewInFolder).toHaveBeenCalledWith("notes");
  });
  it("deletes a note by full path without opening it", () => {
    const props = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "delete notes/ideas.md" }),
    );
    expect(props.onDelete).toHaveBeenCalledWith("notes/ideas.md");
    expect(props.onOpen).not.toHaveBeenCalled();
  });
  it("requests a global new note", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "+ New note" }));
    expect(props.onRequestNew).toHaveBeenCalled();
  });
  it("reveals the active note by expanding its collapsed ancestors", () => {
    localStorage.setItem("cairn.folderTree", JSON.stringify(["notes"]));
    setup({ activePath: "notes/ideas.md" });
    expect(screen.getByRole("button", { name: "ideas" })).toBeInTheDocument();
  });
});
