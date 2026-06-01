import { visit, SKIP } from "unist-util-visit";
import type { Root, Text } from "mdast";

export interface WikiLinkOptions {
  /** Resolve a wikilink target to a note path, or null if it doesn't exist. */
  resolve: (target: string) => string | null;
}

const WIKILINK = /\[\[([^\]]+?)\]\]/g;

/** Turn `[[target]]` / `[[target|alias]]` text into link nodes carrying a
 *  `wikilink resolved|unresolved` class and a `data-wikilink-target` path. */
export function remarkWikiLink({ resolve }: WikiLinkOptions) {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === null || index === undefined) return;
      const value = node.value;
      if (!value.includes("[[")) return;

      const out: unknown[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      WIKILINK.lastIndex = 0;
      while ((m = WIKILINK.exec(value)) !== null) {
        const inner = m[1];
        const target = inner.split("|")[0].trim();
        if (!target) continue;
        const alias = inner.includes("|")
          ? inner.slice(inner.indexOf("|") + 1).trim()
          : target;
        if (m.index > last)
          out.push({ type: "text", value: value.slice(last, m.index) });
        const path = resolve(target);
        out.push({
          type: "link",
          url: "#",
          children: [{ type: "text", value: alias }],
          data: {
            hName: "a",
            hProperties: {
              className: ["wikilink", path ? "resolved" : "unresolved"],
              "data-wikilink-target": path ?? "",
            },
          },
        });
        last = m.index + m[0].length;
      }
      if (out.length === 0) return;
      if (last < value.length)
        out.push({ type: "text", value: value.slice(last) });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parent.children.splice(index, 1, ...(out as any[]));
      return [SKIP, index + out.length];
    });
  };
}
