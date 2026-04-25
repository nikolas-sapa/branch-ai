"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiffNode } from "@/lib/diff";

const BG: Record<string, string> = {
  shared: "bg-neutral-100 border-neutral-300",
  changed: "bg-yellow-50 border-yellow-300",
  "only-a": "bg-green-50 border-green-300",
  "only-b": "bg-blue-50 border-blue-300",
};

const LABEL: Record<string, string> = {
  shared: "shared",
  changed: "changed",
  "only-a": "only A",
  "only-b": "only B",
};

export function DiffCard(props: NodeProps) {
  const { diff, depth } = props.data as { diff: DiffNode; depth: number };
  const isRoot = depth === 0;
  const bg = BG[diff.status] ?? BG.shared;

  return (
    <div
      className={`px-4 py-3 rounded-lg border text-sm max-w-[320px] shadow-sm ${bg} ${
        isRoot ? "font-semibold" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
        {LABEL[diff.status] ?? diff.status}
      </div>

      {diff.status === "shared" && (
        <div className="whitespace-pre-wrap break-words">
          {truncate(diff.contentA ?? diff.contentB ?? "")}
        </div>
      )}

      {diff.status === "changed" && (
        <div className="space-y-2">
          <div className="border-l-2 border-green-500 pl-2 text-green-900 whitespace-pre-wrap break-words">
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mr-1">A:</span>
            {truncate(diff.contentA ?? "")}
          </div>
          <div className="border-l-2 border-blue-500 pl-2 text-blue-900 whitespace-pre-wrap break-words">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mr-1">B:</span>
            {truncate(diff.contentB ?? "")}
          </div>
        </div>
      )}

      {diff.status === "only-a" && (
        <div className="whitespace-pre-wrap break-words text-green-900">
          {truncate(diff.contentA ?? "")}
        </div>
      )}

      {diff.status === "only-b" && (
        <div className="whitespace-pre-wrap break-words text-blue-900">
          {truncate(diff.contentB ?? "")}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function truncate(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
