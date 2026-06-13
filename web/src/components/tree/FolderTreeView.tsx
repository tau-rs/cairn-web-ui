import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { SectionLabel } from "../ui/SectionLabel";
import { buildTree, ancestorFolders, type TreeNode } from "./folderTree";
import { loadCollapsed, saveCollapsed } from "./treePersistence";
import {
  planRenameNotePath,
  planRenameFolder,
  planMoveNote,
  planMoveFolder,
  renamedFolderPath,
  movedFolderPath,
  canDrop,
  type Rename,
} from "./treeMoves";
import type { TreeStyleMap, TreeItemStyle } from "./treeIcons";
import { TreeItemIcon } from "./TreeItemIcon";
import { IconPicker } from "./IconPicker";

/** Inline rename input: autofocuses, selects all, commits on Enter/blur, cancels on Esc. */
function RenameInput(props: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  return (
    <input
      autoFocus
      className="min-w-0 flex-1 rounded border border-accent bg-surface-2 px-1 py-0.5 text-sm text-text outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") props.onCommit(value);
        else if (e.key === "Escape") props.onCancel();
      }}
      onBlur={() => props.onCommit(value)}
    />
  );
}

export function FolderTree(props: {
  paths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onDelete: (path: string) => void;
  onRequestNew: () => void;
  onRequestNewInFolder: (folderPath: string) => void;
  onApplyRenames: (ops: Rename[]) => void;
  styles: TreeStyleMap;
  onSetStyle: (path: string, style: TreeItemStyle) => void;
  onRemapFolderStyles: (from: string, to: string) => void;
}) {
  const tree = useMemo(() => buildTree(props.paths), [props.paths]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    loadCollapsed(),
  );
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragged = useRef<{ path: string; isFolder: boolean } | null>(null);

  const activePath = props.activePath;
  useEffect(() => {
    if (!activePath) return;
    const anc = ancestorFolders(activePath);
    if (anc.length === 0) return;
    setCollapsed((prev) => {
      if (!anc.some((f) => prev.has(f))) return prev;
      const next = new Set(prev);
      for (const f of anc) next.delete(f);
      saveCollapsed(next);
      return next;
    });
  }, [activePath]);

  const toggle = (folderPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      saveCollapsed(next);
      return next;
    });
  };

  const commitRename = (node: TreeNode, newName: string) => {
    setEditingPath(null);
    if (node.kind === "folder") {
      // Remap folder styles by the explicit path change — covers note-less
      // folders, which produce no rename ops.
      const newPath = renamedFolderPath(node.path, newName);
      if (newPath) props.onRemapFolderStyles(node.path, newPath);
    }
    const ops =
      node.kind === "folder"
        ? planRenameFolder(node.path, newName, props.paths)
        : planRenameNotePath(node.path, newName);
    if (ops.length) props.onApplyRenames(ops);
  };

  const onDropInto = (destFolder: string) => {
    const d = dragged.current;
    dragged.current = null;
    setDropTarget(null);
    if (!d) return;
    if (d.isFolder) {
      const newPath = movedFolderPath(d.path, destFolder);
      if (newPath) props.onRemapFolderStyles(d.path, newPath);
    }
    const ops = d.isFolder
      ? planMoveFolder(d.path, destFolder, props.paths)
      : planMoveNote(d.path, destFolder);
    if (ops.length) props.onApplyRenames(ops);
  };

  const startDrag = (e: React.DragEvent, path: string, isFolder: boolean) => {
    dragged.current = { path, isFolder };
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  // Drop-target props for a folder path ("" = root).
  const dropProps = (destFolder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      const d = dragged.current;
      if (d && canDrop(d.path, d.isFolder, destFolder)) {
        e.preventDefault();
        setDropTarget(destFolder);
      }
    },
    onDragLeave: () => setDropTarget((t) => (t === destFolder ? null : t)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      onDropInto(destFolder);
    },
  });

  const iconCell = (path: string, kind: "folder" | "note") => (
    <IconPicker
      targetKind={kind}
      value={props.styles[path] ?? {}}
      onChange={(style) => props.onSetStyle(path, style)}
      trigger={
        <button
          aria-label={`set icon for ${path}`}
          className="flex h-[18px] w-[18px] flex-none items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <TreeItemIcon kind={kind} style={props.styles[path]} />
        </button>
      }
    />
  );

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      const pad = { paddingLeft: depth * 12 + 8 };
      const editing = editingPath === node.path;
      if (node.kind === "folder") {
        const isCollapsed = collapsed.has(node.path);
        const isDrop = dropTarget === node.path;
        return (
          <div key={node.path}>
            <div
              draggable={!editing}
              onDragStart={(e) => startDrag(e, node.path, true)}
              {...dropProps(node.path)}
              style={{ position: "relative" }}
              className={
                "group flex items-center justify-between rounded pr-2 text-muted hover:bg-surface-2 hover:text-text " +
                (isDrop ? "ring-1 ring-accent" : "")
              }
            >
              {props.styles[node.path]?.folderColor && (
                <span
                  data-folder-bar="true"
                  aria-hidden
                  className="absolute bottom-1 left-0.5 top-1 w-[2.5px] rounded"
                  style={{ background: props.styles[node.path]!.folderColor }}
                />
              )}
              {editing ? (
                <span className="flex-1" style={pad}>
                  <RenameInput
                    initial={node.name}
                    onCommit={(v) => commitRename(node, v)}
                    onCancel={() => setEditingPath(null)}
                  />
                </span>
              ) : (
                <div
                  className="flex min-w-0 flex-1 items-center gap-1"
                  style={pad}
                >
                  <button
                    aria-label={`toggle ${node.path}`}
                    className="flex flex-none items-center text-faint"
                    onClick={() => toggle(node.path)}
                  >
                    <span aria-hidden>{isCollapsed ? "▸" : "▾"}</span>
                  </button>
                  {iconCell(node.path, "folder")}
                  <button
                    className="min-w-0 flex-1 truncate py-1 text-left"
                    title={node.path}
                    onClick={() => toggle(node.path)}
                    onDoubleClick={() => setEditingPath(node.path)}
                    onKeyDown={(e) => {
                      if (e.key === "F2") {
                        e.preventDefault();
                        setEditingPath(node.path);
                      }
                    }}
                  >
                    <span className="truncate text-text">{node.name}</span>
                  </button>
                </div>
              )}
              <button
                className="ml-1 hidden text-faint hover:text-text group-hover:block"
                aria-label={`new note in ${node.path}`}
                onClick={() => props.onRequestNewInFolder(node.path)}
              >
                +
              </button>
            </div>
            {!isCollapsed && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const active = node.path === props.activePath;
      return (
        <div
          key={node.path}
          draggable={!editing}
          onDragStart={(e) => startDrag(e, node.path, false)}
          className={`group flex items-center justify-between rounded pr-2 ${
            active
              ? "bg-surface-2 text-text"
              : "text-muted hover:bg-surface-2 hover:text-text"
          }`}
        >
          {!editing && (
            <span className="flex flex-none items-center gap-1" style={pad}>
              <span aria-hidden className="w-[11px]" /> {/* chevron spacer */}
              {iconCell(node.path, "note")}
            </span>
          )}
          {editing ? (
            <span className="flex-1" style={pad}>
              <RenameInput
                initial={node.name}
                onCommit={(v) => commitRename(node, v)}
                onCancel={() => setEditingPath(null)}
              />
            </span>
          ) : (
            <button
              className="min-w-0 flex-1 truncate py-1 text-left"
              title={node.path}
              onClick={() => props.onOpen(node.path)}
              onDoubleClick={() => setEditingPath(node.path)}
              onKeyDown={(e) => {
                if (e.key === "F2") {
                  e.preventDefault();
                  setEditingPath(node.path);
                }
              }}
            >
              {node.name}
            </button>
          )}
          <button
            className="ml-1 hidden text-faint hover:text-danger group-hover:block"
            aria-label={`delete ${node.path}`}
            onClick={() => props.onDelete(node.path)}
          >
            ✕
          </button>
        </div>
      );
    });

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <div
        {...dropProps("")}
        className={
          "mb-1 flex items-center justify-between rounded " +
          (dropTarget === "" ? "ring-1 ring-accent" : "")
        }
      >
        <SectionLabel>Notes</SectionLabel>
        <Button variant="ghost" onClick={props.onRequestNew}>
          + New note
        </Button>
      </div>
      {renderNodes(tree, 0)}
    </div>
  );
}
