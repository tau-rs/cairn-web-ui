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

  it("shows a calm reconnecting pill with no refresh button", () => {
    render(<LiveUpdatesBanner status="reconnecting" onRefresh={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
    expect(screen.queryByRole("button")).toBeNull();
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
