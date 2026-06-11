import { WidgetType } from "@codemirror/view";
import type { ResolvedImage } from "../imageResolver";

export class ImageWidget extends WidgetType {
  constructor(
    readonly image: ResolvedImage,
    readonly alt: string,
    readonly block: boolean,
    readonly from: number,
    readonly onEdit: (from: number) => void,
  ) {
    super();
  }
  eq(other: ImageWidget): boolean {
    return (
      sameImage(other.image, this.image) &&
      other.alt === this.alt &&
      other.block === this.block &&
      other.from === this.from
    );
  }
  toDOM(): HTMLElement {
    if (this.image.kind === "blocked") return this.placeholder(this.image.src);
    return this.imageEl(this.image.url);
  }
  private imageEl(url: string): HTMLImageElement {
    const img = document.createElement("img");
    img.className = this.block ? "cm-lp-img block" : "cm-lp-img";
    img.src = url;
    img.alt = this.alt;
    img.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.onEdit(this.from);
    });
    return img;
  }
  /** Click-to-load placeholder for a remote/`data:` image that has not been
   *  opted into. Loading is per-image and ephemeral (does not touch settings):
   *  clicking "Load" swaps in the real <img> in place. */
  private placeholder(src: string): HTMLElement {
    const box = document.createElement("span");
    box.className = this.block
      ? "cm-lp-img-blocked block"
      : "cm-lp-img-blocked";
    const label = document.createElement("span");
    label.className = "cm-lp-img-blocked-label";
    label.textContent = "Remote image blocked";
    const load = document.createElement("button");
    load.type = "button";
    load.className = "cm-lp-img-blocked-load";
    load.textContent = "Load";
    load.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      box.replaceWith(this.imageEl(src));
    });
    // Clicking the placeholder body (not the button) reveals raw markdown,
    // matching a rendered image's edit affordance.
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.onEdit(this.from);
    });
    box.append(label, load);
    return box;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

function sameImage(a: ResolvedImage, b: ResolvedImage): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "blocked"
    ? a.src === (b as { src: string }).src
    : a.url === (b as { url: string }).url;
}
