"use client";
import { useState } from "react";

export function FinalTextPanel({ finalText }: { finalText: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-colors font-medium"
      >
        {open ? "Hide answer" : "Show answer"}
      </button>

      {open && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
          style={{ height: "30vh" }}
        >
          <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-100">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Final answer</span>
            <button
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-neutral-700 transition-colors text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="h-[calc(30vh-37px)] overflow-y-auto px-6 py-4">
            <pre className="text-sm text-neutral-800 whitespace-pre-wrap font-sans leading-relaxed">{finalText}</pre>
          </div>
        </div>
      )}
    </>
  );
}
