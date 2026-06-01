import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
} from "d3-force";

interface SimNode {
  id: string;
  x?: number;
  y?: number;
}
interface SimLink {
  source: string;
  target: string;
}

/** Run a d3-force simulation to static positions, one per node. Pure: returns
 *  a Map keyed by note path. No animation; fixed tick count. */
export function computeGraphLayout(
  nodes: string[],
  edges: { from: string; to: string }[],
): Map<string, { x: number; y: number }> {
  const ids = new Set(nodes);
  const simNodes: SimNode[] = nodes.map((id) => ({ id }));
  const simLinks: SimLink[] = edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ source: e.from, target: e.to }));

  const sim = forceSimulation<SimNode>(simNodes)
    .force("charge", forceManyBody().strength(-200))
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(80),
    )
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(36))
    .stop();
  sim.tick(300);

  const out = new Map<string, { x: number; y: number }>();
  for (const n of simNodes) out.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  return out;
}
