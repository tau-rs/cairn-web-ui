import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphNode } from "../contract";
import {
  buildGraphData,
  buildAdjacency,
  nodeRadius,
  labelAlpha,
} from "./graph/graphData";
import {
  type RFNode,
  type FG,
  asGraphData,
  linkForce,
} from "./graph/forceGraphTypes";
import { IconButton } from "./ui/IconButton";
import { Spinner } from "./ui/Spinner";
import { GraphForcesPanel } from "./graph/GraphForcesPanel";
import {
  type ForceSettings,
  DEFAULT_FORCE_SETTINGS,
  loadForceSettings,
  saveForceSettings,
} from "./graph/forceSettings";
import { GraphGroupsPanel } from "./graph/GraphGroupsPanel";
import {
  type ColorGroup,
  loadColorGroups,
  saveColorGroups,
  matchGroupColor,
} from "./graph/colorGroups";
import {
  type LocalGraphSettings,
  DEPTH_RANGE,
  localSubgraph,
  loadLocalGraph,
  saveLocalGraph,
} from "./graph/localGraph";
import { TemporalScrubber } from "./graph/TemporalScrubber";
import { useTemporalGraph } from "./graph/useTemporalGraph";
import { buildCompareGraphData } from "./graph/graphData";

export function GraphView(props: {
  nodes: GraphNode[];
  edges: { from: string; to: string }[];
  tagsByNote: Record<string, string[]>; // path → tags, for color-group matching
  activePath: string | null;
  loading?: boolean;
  onOpenNote: (path: string) => void;
}) {
  const [local, setLocal] = useState<LocalGraphSettings>(loadLocalGraph);
  const changeLocal = (next: LocalGraphSettings) => {
    setLocal(next);
    saveLocalGraph(next);
  };

  // Topology helpers work on note paths; project the enriched GraphNode[] once.
  const nodePaths = useMemo(
    () => props.nodes.map((n) => n.path),
    [props.nodes],
  );

  const temporal = useTemporalGraph(props.activePath);

  // Effective source: live uses props; snapshot uses the historical graph
  // (still honoring local mode); compare builds a diff-styled global graph.
  const srcNodes = useMemo(
    () =>
      temporal.source ? temporal.source.nodes.map((n) => n.path) : nodePaths,
    [temporal.source, nodePaths],
  );
  const srcEdges = useMemo(
    () => (temporal.source ? temporal.source.edges : props.edges),
    [temporal.source, props.edges],
  );

  const compareData = useMemo(
    () =>
      temporal.mode === "compare" && temporal.source && temporal.diff
        ? buildCompareGraphData(temporal.source, temporal.diff)
        : null,
    [temporal.mode, temporal.source, temporal.diff],
  );

  // Global graph — memoized on [nodes, edges] ONLY, so opening a note in global
  // mode never restarts the simulation.
  const globalData = useMemo(
    () => buildGraphData(srcNodes, srcEdges),
    [srcNodes, srcEdges],
  );
  // Adjacency from a fresh string-keyed build (the `data.links` array gets
  // mutated by react-force-graph, so don't read neighbor ids from it).
  const globalAdj = useMemo(
    () => buildAdjacency(buildGraphData(srcNodes, srcEdges).links),
    [srcNodes, srcEdges],
  );

  // Local subgraph — computed ONLY when local mode is on with a note open;
  // depends on activePath/depth (the focused neighborhood genuinely changes).
  const useLocal = local.enabled && !!props.activePath;
  const localSub = useMemo(
    () =>
      useLocal
        ? localSubgraph(srcNodes, srcEdges, props.activePath, local.depth)
        : null,
    [useLocal, srcNodes, srcEdges, props.activePath, local.depth],
  );
  const localData = useMemo(
    () => (localSub ? buildGraphData(localSub.nodes, localSub.edges) : null),
    [localSub],
  );
  const localAdj = useMemo(
    () =>
      localSub
        ? buildAdjacency(buildGraphData(localSub.nodes, localSub.edges).links)
        : null,
    [localSub],
  );

  const forcedGlobal = temporal.mode === "compare"; // compare is global-only
  const data =
    compareData ?? (forcedGlobal ? globalData : (localData ?? globalData));
  const adjacency = compareData
    ? buildAdjacency(compareData.links)
    : forcedGlobal
      ? globalAdj
      : (localAdj ?? globalAdj);
  const rfData = asGraphData(data);

  const fgRef = useRef<FG | undefined>(undefined);
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

  const [groups, setGroups] = useState<ColorGroup[]>(loadColorGroups);
  const changeGroups = (next: ColorGroup[]) => {
    setGroups(next);
    saveColorGroups(next);
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
    const link = linkForce(fg);
    link?.strength(forces.linkForce);
    link?.distance(forces.linkDistance);
    fg.d3Force("center")?.strength(forces.center);

    // Freeze = pin every node so the layout holds static (hover still repaints);
    // unfreeze clears the pins.
    for (const n of rfData.nodes) {
      if (forces.frozen) {
        n.fx = n.x;
        n.fy = n.y;
      } else {
        n.fx = undefined;
        n.fy = undefined;
      }
    }
    if (!forces.frozen) fg.d3ReheatSimulation();
  }, [forces, rfData, size.width, size.height]);

  const paintNode = useCallback(
    (node: RFNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const h = hoverRef.current;
      let hl: Set<string> | null = null;
      if (h) {
        hl = new Set<string>([h]);
        for (const n of adjacency.get(h) ?? []) hl.add(n);
      }
      const active = node.id === props.activePath;
      const inHL = hl ? hl.has(node.id) : true;
      const r = nodeRadius(node.degree);
      const nodeState = (node as { state?: string }).state;
      const stateColor =
        nodeState === "appeared"
          ? "#22c55e"
          : nodeState === "disappeared"
            ? "#6b7280"
            : null;
      const base =
        stateColor ??
        (active
          ? "#6366f1"
          : (matchGroupColor(
              node.id,
              props.tagsByNote[node.id] ?? [],
              groups,
            ) ?? "#cdd0e0"));

      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      // Hover focus: dim non-neighbors (keep their group hue at low alpha).
      // Disappeared ghosts and unchanged (compare-mode base) nodes render at a
      // fixed low alpha regardless of hover, so the appeared/disappeared deltas
      // pop against a dimmed base. `state` is only set in compare mode, so live
      // mode is unaffected.
      ctx.globalAlpha =
        nodeState === "disappeared"
          ? 0.4
          : nodeState === "unchanged"
            ? 0.5
            : hl && !inHL && !active
              ? 0.25
              : 1;
      ctx.fillStyle = base;
      ctx.fill();
      ctx.globalAlpha = 1;

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
    [props.activePath, adjacency, groups, props.tagsByNote],
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

  // Link colors react to hover (links touching the hovered node light up);
  // diff state (compare mode) takes priority over hover styling.
  const linkColor = useCallback(
    (link: {
      source: RFNode | string;
      target: RFNode | string;
      state?: string;
    }) => {
      const st = link.state;
      if (st === "appeared") return "#22c55e";
      if (st === "disappeared") return "#6b728066";
      if (st === "unchanged") return "#2a2a30";
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

  // Dashed styling for disappeared (removed) links in compare mode.
  const linkLineDash = useCallback(
    (link: { state?: string }) => (link.state === "disappeared" ? [4, 3] : []),
    [],
  );

  // Single stable container (the ref/ResizeObserver always track THIS div);
  // ForceGraph2D mounts once the container has a measured size.
  return (
    <div ref={containerRef} className="relative h-full w-full">
      {props.loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/50">
          <Spinner label="Loading graph" />
        </div>
      )}
      <div className="absolute left-2 top-2 z-10 flex overflow-hidden rounded-md border border-border text-[11px]">
        {(["local", "global"] as const).map((m) => {
          const isLocal = m === "local";
          const selected = local.enabled === isLocal;
          const compareLocked = temporal.mode === "compare";
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              disabled={compareLocked}
              title={
                compareLocked ? "Compare shows the whole graph" : undefined
              }
              className={
                "px-2.5 py-1 capitalize disabled:cursor-not-allowed disabled:opacity-50 " +
                (selected
                  ? "bg-accent text-accent-fg"
                  : "bg-surface text-muted hover:text-text")
              }
              onClick={() => changeLocal({ ...local, enabled: isLocal })}
            >
              {m}
            </button>
          );
        })}
      </div>
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
        <IconButton
          label="Graph history"
          className="border border-border bg-surface"
          disabled={temporal.disabled}
          title={
            temporal.disabled
              ? "Open a note to scrub its history"
              : "Graph history"
          }
          onClick={() => temporal.setOpen(!temporal.open)}
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </IconButton>
        {panelOpen && (
          <>
            <div className="w-52 rounded-lg border border-border bg-surface p-3 shadow-2xl">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-faint">
                Local graph
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-text">
                <span>Depth</span>
                <span className="text-faint">{local.depth}</span>
              </div>
              <input
                type="range"
                aria-label="Local graph depth"
                className="w-full accent-accent"
                min={DEPTH_RANGE.min}
                max={DEPTH_RANGE.max}
                step={DEPTH_RANGE.step}
                value={local.depth}
                onChange={(e) =>
                  changeLocal({ ...local, depth: Number(e.target.value) })
                }
              />
            </div>
            <GraphGroupsPanel groups={groups} onChange={changeGroups} />
            <GraphForcesPanel
              settings={forces}
              onChange={changeForces}
              onReset={() => changeForces(DEFAULT_FORCE_SETTINGS)}
            />
          </>
        )}
      </div>
      {local.enabled && !props.activePath ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-faint">
          Open a note to see its local graph
        </div>
      ) : (
        size.width > 0 &&
        size.height > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={rfData}
            backgroundColor="rgba(0,0,0,0)"
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={paintPointer}
            linkColor={linkColor}
            linkLineDash={linkLineDash}
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
        )
      )}
      {temporal.open && !temporal.disabled && temporal.timeline && (
        <TemporalScrubber
          timeline={temporal.timeline}
          selection={temporal.selection}
          onSelect={temporal.setSelection}
        />
      )}
    </div>
  );
}
