"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "fork" | "inject";

interface NodeDialogProps {
  sessionId: string;
  nodeId: string;
  initialMode?: Mode;
  onClose: () => void;
  onSuccess?: (newNodeId: string, label: string) => void;
}

export function NodeDialog({ sessionId, nodeId, initialMode = "fork", onClose, onSuccess }: NodeDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    const endpoint = mode === "fork" ? "/api/fork" : "/api/inject";
    const body = mode === "fork"
      ? { sessionId, nodeId, modifier: text }
      : { sessionId, nodeId, fact: text };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);
    onClose();
    router.refresh();

    if (data?.newNodeId && onSuccess) {
      const label = mode === "fork"
        ? `Forked at node ${nodeId.slice(0, 6)}`
        : `Fact injected at node ${nodeId.slice(0, 6)}`;
      onSuccess(data.newNodeId, label);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[480px] shadow-xl border border-neutral-200">
        <div className="flex gap-1 mb-4 border-b border-neutral-100">
          <button
            onClick={() => setMode("fork")}
            className={`px-3 py-2 text-sm transition-colors ${
              mode === "fork"
                ? "border-b-2 border-neutral-900 -mb-px font-medium"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            Fork
          </button>
          <button
            onClick={() => setMode("inject")}
            className={`px-3 py-2 text-sm transition-colors ${
              mode === "inject"
                ? "border-b-2 border-neutral-900 -mb-px font-medium"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            Inject fact
          </button>
        </div>

        <p className="text-xs text-neutral-500 mb-3">
          {mode === "fork" ? "What should change from this point?" : "New fact to incorporate"}
        </p>

        <textarea
          className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-colors"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!text.trim() || loading}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-900 text-white disabled:opacity-40 hover:bg-neutral-700 transition-colors"
          >
            {loading ? "Working…" : mode === "fork" ? "Fork" : "Inject"}
          </button>
        </div>
      </div>
    </div>
  );
}
