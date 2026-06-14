export type DiffLineType = "add" | "del" | "ctx";

export interface DiffLine {
  type: DiffLineType;
  /** Line content, without the trailing newline. */
  text: string;
  /** 1-based line number in the old text; null for an "add". */
  oldLine: number | null;
  /** 1-based line number in the new text; null for a "del". */
  newLine: number | null;
}

// Empty text is zero lines (not [""]) so empty/both-empty edges stay clean.
const toLines = (text: string): string[] =>
  text === "" ? [] : text.split("\n");

/**
 * Line-level diff of `oldText` vs `newText` via longest-common-subsequence.
 * Returns an ordered row list: context lines plus the adds/dels needed to turn
 * old into new. O(n*m) — fine for note-sized documents.
 */
export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = toLines(oldText);
  const newLines = toLines(newText);
  const n = oldLines.length;
  const m = newLines.length;

  // dp[i][j] = LCS length of oldLines[i..] and newLines[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({
        type: "ctx",
        text: oldLines[i],
        oldLine: i + 1,
        newLine: j + 1,
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({
        type: "del",
        text: oldLines[i],
        oldLine: i + 1,
        newLine: null,
      });
      i++;
    } else {
      rows.push({
        type: "add",
        text: newLines[j],
        oldLine: null,
        newLine: j + 1,
      });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", text: oldLines[i], oldLine: i + 1, newLine: null });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", text: newLines[j], oldLine: null, newLine: j + 1 });
    j++;
  }
  return rows;
}
