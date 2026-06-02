import { WidgetType } from "@codemirror/view";

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly block: boolean,
  ) {
    super();
  }
  eq(other: ImageWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.block === this.block
    );
  }
  toDOM(): HTMLElement {
    const img = document.createElement("img");
    img.className = this.block ? "cm-lp-img block" : "cm-lp-img";
    img.src = this.src;
    img.alt = this.alt;
    return img;
  }
  ignoreEvent(): boolean {
    return true;
  }
}
