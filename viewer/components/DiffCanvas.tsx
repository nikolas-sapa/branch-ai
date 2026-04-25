"use client";
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DiffCard } from "./DiffCard";
import { diffTrees } from "@/lib/diff";
import { layoutDiff } from "@/lib/diff-layout";

const nodeTypes = { diffcard: DiffCard };

export function DiffCanvas({
  treeA,
  treeB,
}: {
  treeA: any;
  treeB: any;
}) {
  const { nodes, edges } = useMemo(() => {
    const diff = diffTrees(treeA.root, treeB.root);
    return layoutDiff(diff);
  }, [treeA, treeB]);

  return (
    <div className="h-[calc(100vh-56px)] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background gap={24} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
