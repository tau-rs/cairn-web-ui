import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shell } from "./Shell";

describe("Shell", () => {
  it("renders the three regions and top bar", () => {
    render(
      <Shell
        topBar={<div>top</div>}
        list={<div>list</div>}
        editor={<div>editor</div>}
        backlinks={<div>backlinks</div>}
      />,
    );
    expect(screen.getByText("top")).toBeInTheDocument();
    expect(screen.getByText("list")).toBeInTheDocument();
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText("backlinks")).toBeInTheDocument();
  });
});
