"use client";
import { useState, useMemo } from "react";
import { ReactFlow, Background, Controls, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeCard } from "./NodeCard";
import { NodeDialog } from "./NodeDialog";
import { layoutTree } from "@/lib/layout";

const nodeTypes = { card: NodeCard };

interface RawNode {
  id: string;
  content: string;
  children: RawNode[];
}

export function TreeCanvas({ root, sessionId }: { root: RawNode; sessionId: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [forkingNodeId, setForkingNodeId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    function filter(n: RawNode): RawNode {
      if (collapsed.has(n.id)) return { ...n, children: [] };
      return { ...n, children: n.children.map(filter) };
    }
    const filtered = filter(root);
    const { nodes: baseNodes, edges: baseEdges } = layoutTree(filtered);

    // Build a map of original child counts (before collapse filtering)
    const origChildCount = new Map<string, number>();
    (function walk(n: RawNode) {
      origChildCount.set(n.id, n.children.length);
      n.children.forEach(walk);
    })(root);

    const enhancedNodes = baseNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        hasChildren: (origChildCount.get(n.id) ?? 0) > 0,
        collapsed: collapsed.has(n.id),
        onToggle: () => {
          setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
            return next;
          });
        },
      },
    }));
    return { nodes: enhancedNodes, edges: baseEdges };
  }, [root, collapsed]);

  return (
    <div className="h-[calc(100vh-56px)] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onNodeClick={(_, n) => setForkingNodeId(n.id)}
      >
        <Background gap={24} size={1} />
        <Controls />
      </ReactFlow>
      {forkingNodeId && (
        <NodeDialog sessionId={sessionId} nodeId={forkingNodeId} onClose={() => setForkingNodeId(null)} />
      )}
    </div>
  );
}
