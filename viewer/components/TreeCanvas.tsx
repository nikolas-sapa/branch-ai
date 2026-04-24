"use client";
import { useState } from "react";
import { ReactFlow, Background, Controls, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeCard } from "./NodeCard";
import { NodeDialog } from "./NodeDialog";

const nodeTypes = { card: NodeCard };

export function TreeCanvas({ nodes, edges, sessionId }: { nodes: RFNode[]; edges: RFEdge[]; sessionId: string }) {
  const [forkingNodeId, setForkingNodeId] = useState<string | null>(null);
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
        <NodeDialog
          sessionId={sessionId}
          nodeId={forkingNodeId}
          onClose={() => setForkingNodeId(null)}
        />
      )}
    </div>
  );
}
