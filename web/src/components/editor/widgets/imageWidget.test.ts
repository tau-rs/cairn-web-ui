import { describe, it, expect, vi } from "vitest";
import { ImageWidget } from "./imageWidget";

describe("ImageWidget", () => {
  it("renders an <img> for a ready image", () => {
    const w = new ImageWidget(
      { kind: "ready", url: "asset://img/x.png" },
      "alt text",
      false,
      0,
      vi.fn(),
    );
    const el = w.toDOM();
    expect(el).toBeInstanceOf(HTMLImageElement);
    expect((el as HTMLImageElement).src).toContain("asset://img/x.png");
    expect((el as HTMLImageElement).alt).toBe("alt text");
  });

  it("renders a placeholder (no <img>, no fetch) for a blocked image", () => {
    const w = new ImageWidget(
      { kind: "blocked", src: "https://attacker.example/beacon.png" },
      "alt",
      false,
      0,
      vi.fn(),
    );
    const el = w.toDOM();
    expect(el).not.toBeInstanceOf(HTMLImageElement);
    // Crucially: nothing in the rendered tree carries the remote src as an
    // <img src>, so opening the note fires no network request.
    expect(el.querySelector("img")).toBeNull();
    expect(el.outerHTML).not.toContain("attacker.example");
  });

  it("loads the blocked image in place when its Load button is clicked", () => {
    const w = new ImageWidget(
      { kind: "blocked", src: "https://x/y.png" },
      "alt",
      false,
      0,
      vi.fn(),
    );
    const box = w.toDOM();
    const parent = document.createElement("div");
    parent.appendChild(box);
    const load = box.querySelector(
      ".cm-lp-img-blocked-load",
    ) as HTMLButtonElement;
    expect(load).not.toBeNull();
    load.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const img = parent.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("https://x/y.png");
  });

  it("does not call onEdit when the Load button is clicked", () => {
    const onEdit = vi.fn();
    const w = new ImageWidget(
      { kind: "blocked", src: "https://x/y.png" },
      "alt",
      false,
      3,
      onEdit,
    );
    const box = w.toDOM();
    document.createElement("div").appendChild(box);
    const load = box.querySelector(
      ".cm-lp-img-blocked-load",
    ) as HTMLButtonElement;
    load.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("reveals raw markdown (onEdit) when the placeholder body is clicked", () => {
    const onEdit = vi.fn();
    const w = new ImageWidget(
      { kind: "blocked", src: "https://x/y.png" },
      "alt",
      false,
      7,
      onEdit,
    );
    const box = w.toDOM();
    box.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onEdit).toHaveBeenCalledWith(7);
  });
});
