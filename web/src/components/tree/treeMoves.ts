export interface Rename {
  from: string;
  to: string;
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}
function baseName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}
const join = (dir: string, name: string): string =>
  dir ? `${dir}/${name}` : name;

/** Rename a note's filename within its folder. `newName` is a bare stem
 *  (slashes rejected; a typed `.md` is stripped). [] if empty/invalid/unchanged. */
export function planRenameNote(notePath: string, newName: string): Rename[] {
  const name = newName.trim().replace(/\.md$/, "");
  if (!name || name.includes("/")) return [];
  const to = join(dirOf(notePath), `${name}.md`);
  return to === notePath ? [] : [{ from: notePath, to }];
}

/** Replace a folder's last segment → one Rename per descendant note. */
export function planRenameFolder(
  folderPath: string,
  newName: string,
  allPaths: string[],
): Rename[] {
  const name = newName.trim();
  if (!name || name.includes("/")) return [];
  const newFolder = join(dirOf(folderPath), name);
  if (newFolder === folderPath) return [];
  const prefix = `${folderPath}/`;
  return allPaths
    .filter((p) => p.startsWith(prefix))
    .map((p) => ({ from: p, to: newFolder + p.slice(folderPath.length) }));
}

/** Move a note into `destFolder` ("" = root). [] if already there. */
export function planMoveNote(notePath: string, destFolder: string): Rename[] {
  if (dirOf(notePath) === destFolder) return [];
  return [{ from: notePath, to: join(destFolder, baseName(notePath)) }];
}

/** Move a folder's subtree under `destFolder`. [] when the drop isn't allowed. */
export function planMoveFolder(
  folderPath: string,
  destFolder: string,
  allPaths: string[],
): Rename[] {
  if (!canDrop(folderPath, true, destFolder)) return [];
  const newFolder = join(destFolder, baseName(folderPath));
  const prefix = `${folderPath}/`;
  return allPaths
    .filter((p) => p.startsWith(prefix))
    .map((p) => ({ from: p, to: newFolder + p.slice(folderPath.length) }));
}

/** Whether dropping `draggedPath` into `destFolder` ("" = root) is a real move:
 *  not the current parent, not itself, not a folder into its own subtree. */
export function canDrop(
  draggedPath: string,
  isFolder: boolean,
  destFolder: string,
): boolean {
  if (isFolder) {
    if (destFolder === draggedPath) return false;
    if (destFolder.startsWith(`${draggedPath}/`)) return false;
    return dirOf(draggedPath) !== destFolder;
  }
  return dirOf(draggedPath) !== destFolder;
}
