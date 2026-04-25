"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { ReactFlow, Background, Controls, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeCard } from "./NodeCard";
import { NodeDialog } from "./NodeDialog";
import { PresenceLayer } from "./PresenceLayer";
import { PeopleIndicator } from "./PeopleIndicator";
import { layoutTree } from "@/lib/layout";
import { makeProvider } from "@/lib/presence";

const nodeTypes = { card: NodeCard };

interface RawNode {
  id: string;
  content: string;
  children: RawNode[];
}

export function TreeCanvas({ root, sessionId }: { root: RawNode; sessionId: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [forkingNodeId, setForkingNodeId] = useState<string | null>(null);
  const providerRef = useRef<ReturnType<typeof makeProvider> | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    providerRef.current = makeProvider(sessionId);
    forceUpdate((n) => n + 1);

    const onMove = (e: MouseEvent) => {
      const p = providerRef.current;
      if (!p) return;
      p.provider.awareness.setLocalState({ ...p.me, cursor: { x: e.clientX, y: e.clientY } });
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
      providerRef.current?.provider.destroy();
      providerRef.current = null;
    };
  }, [sessionId]);

  const { nodes, edges } = useMemo(() => {
    function filter(n: RawNode): RawNode {
      if (collapsed.has(n.id)) return { ...n, children: [] };
      return { ...n, children: n.children.map(filter) };
    }
    const filtered = filter(root);
    const { nodes: baseNodes, edges: baseEdges } = layoutTree(filtered);

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

  const p = providerRef.current;

  return (
    <div className="h-[calc(100vh-56px)] w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onNodeClick={(_, n) => {
          setForkingNodeId(n.id);
          if (p) {
            p.provider.awareness.setLocalState({ ...p.me, selectedNodeId: n.id });
          }
        }}
      >
        <Background gap={24} size={1} />
        <Controls />
      </ReactFlow>

      {forkingNodeId && (
        <NodeDialog sessionId={sessionId} nodeId={forkingNodeId} onClose={() => setForkingNodeId(null)} />
      )}

      {p && <PresenceLayer provider={p.provider} />}

      {p && (
        <div className="absolute top-3 right-3 z-50 bg-white/90 backdrop-blur rounded-full px-2 py-1 shadow-sm border border-neutral-200">
          <PeopleIndicator provider={p.provider} me={p.me} />
        </div>
      )}
    </div>
  );
}
