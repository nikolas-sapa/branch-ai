"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export function NodeCard(props: NodeProps) {
  const data = props.data as {
    content: string;
    depth: number;
    hasChildren: boolean;
    collapsed: boolean;
    onToggle?: () => void;
    forkedFrom?: string;
    injectedFact?: string;
  };
  const isRoot = data.depth === 0;
  const provenance = data.forkedFrom
    ? `forked at: ${data.forkedFrom.slice(0, 40)}${data.forkedFrom.length > 40 ? "…" : ""}`
    : data.injectedFact
    ? `injected: ${data.injectedFact.slice(0, 40)}${data.injectedFact.length > 40 ? "…" : ""}`
    : null;

  return (
    <div
      className={`px-4 py-3 rounded-lg border text-sm max-w-[280px] shadow-sm relative ${
        isRoot ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {provenance && (
        <p className="text-xs italic text-neutral-400 mb-2 leading-snug border-l-2 border-neutral-200 pl-2">
          &#8627; {provenance}
        </p>
      )}
      <div className="whitespace-pre-wrap">
        {data.content.length > 220 ? data.content.slice(0, 220) + "…" : data.content}
      </div>
      {data.hasChildren && data.onToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onToggle!(); }}
          className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
            isRoot ? "bg-neutral-900 text-white border-neutral-700" : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400"
          }`}
          aria-label={data.collapsed ? "Expand subtree" : "Collapse subtree"}
        >
          {data.collapsed ? "▸" : "▾"}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
