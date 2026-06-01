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
  const elements = useMemo(() => {
    const positions = computeGraphLayout(props.nodes, props.edges);
    return buildFlowElements(
      props.nodes,
      props.edges,
      positions,
      props.activePath,
    );
  }, [props.nodes, props.edges, props.activePath]);

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
