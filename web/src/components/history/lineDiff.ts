export type DiffRow = {
  type: "add" | "del" | "ctx";
  text: string;
};

/**
 * A small line-level diff via the classic LCS dynamic program. Returns a flat
 * sequence of rows: deletions (only in `oldText`), additions (only in
 * `newText`), and unchanged context lines. Whitespace and blank lines are
 * preserved verbatim. No dependency — kept lean and unit-testable.
 */
export function lineDiff(oldText: string, newText: string): DiffRow[] {
  // An empty document is zero lines, not one blank line — avoids a phantom
  // empty add/del row when diffing against an empty side.
  const a = oldText === "" ? [] : oldText.split("\n");
  const b = newText === "" ? [] : newText.split("\n");
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: "del", text: a[i] });
      i++;
    } else {
      rows.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: "del", text: a[i++] });
  while (j < m) rows.push({ type: "add", text: b[j++] });
  return rows;
}
