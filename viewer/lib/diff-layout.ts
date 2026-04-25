import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { DiffNode } from "./diff";

const COLORS: Record<string, string> = {
  shared: "#d4d4d4",
  changed: "#facc15",
  "only-a": "#22c55e",
  "only-b": "#3b82f6",
};

export function layoutDiff(root: DiffNode): {
  nodes: RFNode[];
  edges: RFEdge[];
} {
  const nodes: RFNode[] = [];
  const edges: RFEdge[] = [];
  const LEVEL_H = 180;
  const NODE_W = 320;

  function computeWidth(n: DiffNode): number {
    if (n.children.length === 0) return NODE_W + 32;
    return n.children.reduce((s, c) => s + computeWidth(c), 0);
  }

  function walk(n: DiffNode, depth: number, x: number): void {
    const width = computeWidth(n);
    const nodeX = x + width / 2 - NODE_W / 2;
    nodes.push({
      id: n.id,
      position: { x: nodeX, y: depth * LEVEL_H },
      data: { diff: n, depth },
      type: "diffcard",
    });
    let childX = x;
    for (const child of n.children) {
      const childWidth = computeWidth(child);
      edges.push({
        id: `${n.id}->${child.id}`,
        source: n.id,
        target: child.id,
        type: "smoothstep",
        style: { stroke: COLORS[child.status] ?? "#d4d4d4" },
      });
      walk(child, depth + 1, childX);
      childX += childWidth;
    }
  }

  walk(root, 0, 0);
  return { nodes, edges };
}
