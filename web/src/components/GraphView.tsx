import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import { computeGraphLayout } from "./graph/computeLayout";
import { buildFlowElements } from "./graph/buildFlowElements";

export function GraphView(props: {
  nodes: string[];
  edges: { from: string; to: string }[];
  activePath: string | null;
  onOpenNote: (path: string) => void;
}) {
  // Layout depends only on the graph shape — recomputing it on an active-note
  // change would needlessly re-run the force simulation (and visibly re-lay-out
  // the graph). Mapping to React Flow elements is cheap and folds in the
  // active-note highlight.
  const positions = useMemo(
    () => computeGraphLayout(props.nodes, props.edges),
    [props.nodes, props.edges],
  );
  const elements = useMemo(
    () => buildFlowElements(props.nodes, props.edges, positions, props.activePath),
    [props.nodes, props.edges, positions, props.activePath],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={elements.nodes as Node[]}
        edges={elements.edges as Edge[]}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => props.onOpenNote(node.id)}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
