import { describe, it, expect, beforeEach } from "vitest";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopBar } from "./TopBar";
import { cairnStore } from "../app/cairnStore";

beforeEach(() => {
  cairnStore.setState({
    query: "",
    backlinks: [],
    saving: false,
    dirty: false,
    uncommitted: false,
    lastCommit: null,
    committing: false,
  });
});

function renderCounted() {
  let commits = 0;
  const onRender: ProfilerOnRenderCallback = () => {
    commits++;
  };
  render(
    <MemoryRouter>
      <Profiler id="topbar" onRender={onRender}>
        <TopBar />
      </Profiler>
    </MemoryRouter>,
  );
  return () => commits;
}

describe("TopBar subscription isolation", () => {
  it("does NOT re-render when an unrelated slice (backlinks) changes", () => {
    const commits = renderCounted();
    const before = commits();
    act(() => cairnStore.setState({ backlinks: ["x.md"] }));
    expect(commits()).toBe(before);
  });

  it("DOES re-render when its own slice (query) changes", () => {
    const commits = renderCounted();
    const before = commits();
    act(() => cairnStore.setState({ query: "hello" }));
    expect(commits()).toBe(before + 1);
  });
});
