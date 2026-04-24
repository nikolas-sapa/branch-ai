"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export function NodeCard(props: NodeProps) {
  const data = props.data as { content: string; depth: number };
  const isRoot = data.depth === 0;
  return (
    <div
      className={`px-4 py-3 rounded-lg border text-sm max-w-[280px] shadow-sm ${
        isRoot ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="whitespace-pre-wrap">
        {data.content.length > 220 ? data.content.slice(0, 220) + "…" : data.content}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
