import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import {
  buildGraphData,
  buildAdjacency,
  nodeRadius,
  labelAlpha,
  type GLink,
} from "./graph/graphData";
import { IconButton } from "./ui/IconButton";
import { GraphForcesPanel } from "./graph/GraphForcesPanel";
import {
  type ForceSettings,
  DEFAULT_FORCE_SETTINGS,
  loadForceSettings,
  saveForceSettings,
} from "./graph/forceSettings";

// react-force-graph mutates node objects (adds x/y/vx/vy) and rewrites
// link.source/target from id strings into node references at runtime.
interface RFNode {
  id: string;
  label: string;
  degree: number;
  x?: number;
  y?: number;
  fx?: number; // d3 pin (set to freeze, undefined to release)
  fy?: number;
}

export function GraphView(props: {
  nodes: string[];
  edges: { from: string; to: string }[];
  tagsByNote: Record<string, string[]>; // consumed in Task 5 (color groups)
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
  const [forces, setForces] = useState<ForceSettings>(loadForceSettings);
  const [panelOpen, setPanelOpen] = useState(false);

  const changeForces = (next: ForceSettings) => {
    setForces(next);
    saveForceSettings(next);
  };

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

  // Apply force settings to the d3 simulation (imperative; forces created by
  // react-force-graph). Re-applies on settings/data/size change.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(forces.repel);
    const link = fg.d3Force("link") as
      | { strength: (n: number) => unknown; distance: (n: number) => unknown }
      | undefined;
    link?.strength(forces.linkForce);
    link?.distance(forces.linkDistance);
    fg.d3Force("center")?.strength(forces.center);

    // Freeze = pin every node so the layout holds static (hover still repaints);
    // unfreeze clears the pins.
    for (const n of data.nodes as RFNode[]) {
      if (forces.frozen) {
        n.fx = n.x;
        n.fy = n.y;
      } else {
        n.fx = undefined;
        n.fy = undefined;
      }
    }
    if (!forces.frozen) fg.d3ReheatSimulation();
  }, [forces, data, size.width, size.height]);

  const paintNode = useCallback(
    (node: RFNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const h = hoverRef.current;
      let hl: Set<string> | null = null;
      if (h) {
        hl = new Set<string>([h]);
        for (const n of adjacency.get(h) ?? []) hl.add(n);
      }
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
    <div ref={containerRef} className="relative h-full w-full">
      <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-2">
        <IconButton
          label="Graph forces"
          className="border border-border bg-surface"
          onClick={() => setPanelOpen((o) => !o)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </IconButton>
        {panelOpen && (
          <GraphForcesPanel
            settings={forces}
            onChange={changeForces}
            onReset={() => changeForces(DEFAULT_FORCE_SETTINGS)}
          />
        )}
      </div>
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
