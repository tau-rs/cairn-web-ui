/** Tags from a note's markdown: a frontmatter `tags:` key (inline `[a, b]` /
 *  `a, b`, or a `- item` block list) plus inline `#tag` tokens in the body.
 *  Lowercased, deduped, order preserved. (A simple scan — does not exclude `#`
 *  inside code spans/fences; acceptable for v1.) */
export function extractTags(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const t = raw
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  let body = markdown;
  if (markdown.startsWith("---\n")) {
    const end = markdown.indexOf("\n---", 4);
    if (end !== -1) {
      const fm = markdown.slice(4, end);
      body = markdown.slice(end + 4);
      const lines = fm.split("\n");
      const i = lines.findIndex((l) => /^tags:/.test(l));
      if (i !== -1) {
        const inline = lines[i].replace(/^tags:\s*/, "").trim();
        if (inline.startsWith("[")) {
          inline
            .replace(/^\[|\]$/g, "")
            .split(",")
            .forEach(add);
        } else if (inline) {
          inline.split(",").forEach(add);
        } else {
          // block list: subsequent `- item` lines until a non-list line
          for (let j = i + 1; j < lines.length; j++) {
            const m = /^\s*-\s*(.+)$/.exec(lines[j]);
            if (m) add(m[1]);
            else break;
          }
        }
      }
    }
  }

  const re = /(?:^|\s)#([A-Za-z0-9_/-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) add(m[1]);
  return out;
}
