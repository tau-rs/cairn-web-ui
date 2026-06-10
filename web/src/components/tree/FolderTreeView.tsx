import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { SectionLabel } from "../ui/SectionLabel";
import { buildTree, ancestorFolders, type TreeNode } from "./folderTree";
import { loadCollapsed, saveCollapsed } from "./treePersistence";

export function FolderTree(props: {
  paths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onDelete: (path: string) => void;
  onRequestNew: () => void;
  onRequestNewInFolder: (folderPath: string) => void;
}) {
  const tree = useMemo(() => buildTree(props.paths), [props.paths]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    loadCollapsed(),
  );

  // Reveal-on-change: when the active note changes, expand its ancestor folders
  // (so a newly-opened or restored-on-load note is visible). Runs only on change,
  // so the user can re-collapse afterward.
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

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      const pad = { paddingLeft: depth * 12 + 8 };
      if (node.kind === "folder") {
        const isCollapsed = collapsed.has(node.path);
        return (
          <div key={node.path}>
            <div className="group flex items-center justify-between rounded pr-2 text-muted hover:bg-surface-2 hover:text-text">
              <button
                className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
                style={pad}
                title={node.path}
                onClick={() => toggle(node.path)}
              >
                <span aria-hidden="true" className="text-faint">
                  {isCollapsed ? "▸" : "▾"}
                </span>
                <span className="truncate">{node.name}</span>
              </button>
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
          className={`group flex items-center justify-between rounded pr-2 ${
            active
              ? "bg-surface-2 text-text"
              : "text-muted hover:bg-surface-2 hover:text-text"
          }`}
        >
          <button
            className="min-w-0 flex-1 truncate py-1 text-left"
            style={pad}
            title={node.path}
            onClick={() => props.onOpen(node.path)}
          >
            {node.name}
          </button>
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
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>Notes</SectionLabel>
        <Button variant="ghost" onClick={props.onRequestNew}>
          + New note
        </Button>
      </div>
      {renderNodes(tree, 0)}
    </div>
  );
}
