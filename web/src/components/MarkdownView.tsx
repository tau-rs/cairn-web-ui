import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { remarkWikiLink } from "./remarkWikiLink";
import { stem } from "../client/wikilink";

export function MarkdownView(props: {
  contents: string;
  notePaths: string[];
  onOpenNote: (path: string) => void;
}) {
  const resolve = useMemo(() => {
    const byStem = new Map<string, string>();
    for (const p of props.notePaths) byStem.set(stem(p), p);
    return (target: string) => byStem.get(stem(target)) ?? null;
  }, [props.notePaths]);

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkWikiLink, { resolve }]]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a({ className, children, href, ...rest }) {
            const cls = Array.isArray(className)
              ? className.join(" ")
              : (className ?? "");
            if (cls.includes("wikilink")) {
              const target = (rest as Record<string, unknown>)[
                "data-wikilink-target"
              ] as string;
              if (cls.includes("unresolved") || !target) {
                return (
                  <span className="text-neutral-500 underline decoration-dotted">
                    {children}
                  </span>
                );
              }
              return (
                <a
                  href="#"
                  className="cursor-pointer text-sky-400 no-underline hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    props.onOpenNote(target);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {props.contents}
      </ReactMarkdown>
    </div>
  );
}
