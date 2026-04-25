"use client";
import { useState, useEffect } from "react";
import { isLocalViewer } from "@/lib/mode";

interface NodePreviewProps {
  content: string;
  onFork: () => void;
  onInject: () => void;
  onClose: () => void;
}

export function NodePreview({ content, onFork, onInject, onClose }: NodePreviewProps) {
  const [local, setLocal] = useState(true);
  useEffect(() => { setLocal(isLocalViewer()); }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none"
      aria-modal="true"
    >
      {/* Backdrop — only covers click area, not the whole viewport visually */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onClose}
        aria-label="Close preview"
      />
      <div className="relative pointer-events-auto m-6 w-[420px] max-h-[60vh] bg-white rounded-xl shadow-xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Node content</span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-neutral-100">
          {local ? (
            <div className="flex gap-2">
              <button
                onClick={onFork}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
              >
                Fork from here
              </button>
              <button
                onClick={onInject}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Inject fact
              </button>
            </div>
          ) : (
            <div className="bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm">
              <div className="font-medium text-neutral-800 mb-1">Want to explore from this point?</div>
              <div className="text-neutral-500 mb-3 text-xs leading-relaxed">
                Install Branch to fork reasoning from any node and add facts mid-thought.
              </div>
              <a
                href="https://github.com/84yk8btb9f-prog/branch-ai#install"
                target="_blank"
                rel="noreferrer"
                className="inline-block px-3 py-1.5 rounded bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
              >
                npm install -g branch-ai →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
