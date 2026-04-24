"use client";
import { ReactFlow, Background, Controls, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeCard } from "./NodeCard";

const nodeTypes = { card: NodeCard };

export function TreeCanvas({ nodes, edges }: { nodes: RFNode[]; edges: RFEdge[] }) {
  return (
    <div className="h-[calc(100vh-56px)] w-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }}>
        <Background gap={24} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
