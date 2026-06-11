import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveUpdatesBanner } from "./LiveUpdatesBanner";

describe("LiveUpdatesBanner", () => {
  it("renders nothing when live updates are ok", () => {
    const { container } = render(
      <LiveUpdatesBanner status="ok" onRefresh={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a refresh affordance when down and fires onRefresh", () => {
    const onRefresh = vi.fn();
    render(<LiveUpdatesBanner status="down" onRefresh={onRefresh} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /live updates unavailable/i,
    );
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
