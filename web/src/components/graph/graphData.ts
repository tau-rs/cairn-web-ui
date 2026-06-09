import { stem } from "../../client/wikilink";

export interface GNode {
  id: string;
  label: string;
  degree: number;
}
export interface GLink {
  source: string;
  target: string;
}

/** Build force-graph data: degree = count of links touching the node
 *  (undirected); label = stem(path); links filtered to edges whose endpoints
 *  both exist. */
export function buildGraphData(
  nodes: string[],
  edges: { from: string; to: string }[],
): { nodes: GNode[]; links: GLink[] } {
  const ids = new Set(nodes);
  const links: GLink[] = edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ source: e.from, target: e.to }));

  const degree = new Map<string, number>();
  for (const id of nodes) degree.set(id, 0);
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
  }

  const gnodes: GNode[] = nodes.map((id) => ({
    id,
    label: stem(id),
    degree: degree.get(id) ?? 0,
  }));
  return { nodes: gnodes, links };
}

/** Symmetric adjacency for hover-neighbor highlighting. Pass STRING-keyed links
 *  (react-force-graph mutates link.source/target into node objects, so build
 *  this from the original string links, not the mutated array). */
export function buildAdjacency(links: GLink[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const l of links) {
    add(l.source, l.target);
    add(l.target, l.source);
  }
  return adj;
}

/** Node radius from degree — sublinear so hubs are bigger but not huge. */
export function nodeRadius(degree: number): number {
  return 3 + 1.6 * Math.sqrt(degree);
}

/** Label opacity from the current zoom scale — hidden when zoomed out, ramps to
 *  1 as you zoom in. */
export function labelAlpha(zoom: number): number {
  const lo = 1.2;
  const hi = 2.5;
  if (zoom <= lo) return 0;
  if (zoom >= hi) return 1;
  return (zoom - lo) / (hi - lo);
}
