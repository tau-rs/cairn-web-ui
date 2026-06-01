import { stem } from "../../client/wikilink";

export interface FlowNode {
  id: string;
  position: { x: number; y: number };
  data: { label: string; active: boolean };
  style: Record<string, string | number>;
}
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  markerEnd: { type: "arrowclosed" };
}

const ACTIVE_STYLE: Record<string, string | number> = {
  background: "#5b7cff",
  color: "#fff",
  border: "1px solid #9ab0ff",
  borderRadius: 6,
  fontSize: 11,
  padding: 4,
};
const NODE_STYLE: Record<string, string | number> = {
  background: "#23232e",
  color: "#cfd2dc",
  border: "1px solid #3a3a4a",
  borderRadius: 6,
  fontSize: 11,
  padding: 4,
};

/** Map cairn graph data + positions to React Flow node/edge objects. Pure. */
export function buildFlowElements(
  nodes: string[],
  edges: { from: string; to: string }[],
  positions: Map<string, { x: number; y: number }>,
  activePath: string | null,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const flowNodes: FlowNode[] = nodes.map((path) => {
    const active = path === activePath;
    return {
      id: path,
      position: positions.get(path) ?? { x: 0, y: 0 },
      data: { label: stem(path), active },
      style: active ? ACTIVE_STYLE : NODE_STYLE,
    };
  });
  const flowEdges: FlowEdge[] = edges.map((e) => ({
    id: `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    markerEnd: { type: "arrowclosed" },
  }));
  return { nodes: flowNodes, edges: flowEdges };
}
