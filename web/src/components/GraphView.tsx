import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import {
  buildGraphData,
  buildAdjacency,
  nodeRadius,
  labelAlpha,
  type GLink,
} from "./graph/graphData";

// react-force-graph mutates node objects (adds x/y/vx/vy) and rewrites
// link.source/target from id strings into node references at runtime.
interface RFNode {
  id: string;
  label: string;
  degree: number;
  x?: number;
  y?: number;
}

export function GraphView(props: {
  nodes: string[];
  edges: { from: string; to: string }[];
  activePath: string | null;
  onOpenNote: (path: string) => void;
}) {
  // Graph shape only — NOT activePath/hover, so the simulation never restarts
  // when you open a note or hover.
  const data = useMemo(
    () => buildGraphData(props.nodes, props.edges),
    [props.nodes, props.edges],
  );
  // Adjacency from a fresh string-keyed build (the `data.links` array gets
  // mutated by react-force-graph, so don't read neighbor ids from it).
  const adjacency = useMemo(
    () => buildAdjacency(buildGraphData(props.nodes, props.edges).links),
    [props.nodes, props.edges],
  );

  const fgRef = useRef<ForceGraphMethods<RFNode, GLink>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<string | null>(null);
  const fittedRef = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Size the canvas to the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // New graph data → allow one zoom-to-fit.
  useEffect(() => {
    fittedRef.current = false;
  }, [data]);

  const highlight = (): Set<string> | null => {
    const h = hoverRef.current;
    if (!h) return null;
    const set = new Set<string>([h]);
    for (const n of adjacency.get(h) ?? []) set.add(n);
    return set;
  };

  const paintNode = useCallback(
    (node: RFNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const hl = highlight();
      const active = node.id === props.activePath;
      const lit = hl ? hl.has(node.id) : true;
      const r = nodeRadius(node.degree);

      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = active ? "#6366f1" : lit ? "#cdd0e0" : "#6b6c7755";
      ctx.fill();

      let alpha = labelAlpha(scale);
      if (active || node.id === hoverRef.current) alpha = 1;
      if (alpha > 0) {
        const font = 12 / scale; // constant on-screen size
        ctx.font = `${font}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = alpha;
        ctx.fillStyle = active ? "#cdd0e0" : "#9a9ba6";
        ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 1);
        ctx.globalAlpha = 1;
      }
    },
    [props.activePath, adjacency],
  );

  const paintPointer = useCallback(
    (node: RFNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        node.x ?? 0,
        node.y ?? 0,
        nodeRadius(node.degree),
        0,
        2 * Math.PI,
      );
      ctx.fill();
    },
    [],
  );

  // Link colors react to hover (links touching the hovered node light up).
  const linkColor = useCallback(
    (link: { source: RFNode | string; target: RFNode | string }) => {
      const h = hoverRef.current;
      if (!h) return "#3a3a44";
      const sid =
        typeof link.source === "string" ? link.source : link.source.id;
      const tid =
        typeof link.target === "string" ? link.target : link.target.id;
      return sid === h || tid === h ? "#6366f1aa" : "#26262e66";
    },
    [],
  );

  // Single stable container (the ref/ResizeObserver always track THIS div);
  // ForceGraph2D mounts once the container has a measured size.
  return (
    <div ref={containerRef} className="h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={data as { nodes: RFNode[]; links: GLink[] }}
          backgroundColor="rgba(0,0,0,0)"
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointer}
          linkColor={linkColor}
          linkWidth={1}
          autoPauseRedraw={false}
          enableNodeDrag
          onNodeClick={(n: RFNode) => props.onOpenNote(n.id)}
          onNodeHover={(n: RFNode | null) => {
            hoverRef.current = n?.id ?? null;
          }}
          onEngineStop={() => {
            if (!fittedRef.current) {
              fittedRef.current = true;
              fgRef.current?.zoomToFit(400, 40);
            }
          }}
        />
      )}
    </div>
  );
}
