/** Given pointer position `p` along an axis and the sorted center offsets of each
 *  item, return the index the dragged item should land at. */
export function dropIndex(p: number, centers: number[]): number {
  let i = 0;
  while (i < centers.length && p > centers[i]) i++;
  return i;
}
