import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

interface TreeNode {
  id: string;
  content: string;
  children: TreeNode[];
}

export function layoutTree(root: TreeNode): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = [];
  const edges: RFEdge[] = [];
  const LEVEL_H = 160;
  const NODE_W = 280;

  function computeWidth(n: TreeNode): number {
    if (n.children.length === 0) return NODE_W + 32;
    return n.children.reduce((sum, c) => sum + computeWidth(c), 0);
  }

  function walk(n: TreeNode, depth: number, x: number): number {
    const width = computeWidth(n);
    const nodeX = x + width / 2 - NODE_W / 2;
    nodes.push({
      id: n.id,
      position: { x: nodeX, y: depth * LEVEL_H },
      data: { content: n.content, depth },
      type: "card",
    });
    let childX = x;
    for (const child of n.children) {
      const childWidth = computeWidth(child);
      edges.push({
        id: `${n.id}-${child.id}`,
        source: n.id,
        target: child.id,
        type: "smoothstep",
      });
      walk(child, depth + 1, childX);
      childX += childWidth;
    }
    return width;
  }

  walk(root, 0, 0);
  return { nodes, edges };
}
