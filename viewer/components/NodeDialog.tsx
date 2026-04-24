"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "fork" | "inject";

export function NodeDialog({ sessionId, nodeId, onClose }: { sessionId: string; nodeId: string; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("fork");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    const endpoint = mode === "fork" ? "/api/fork" : "/api/inject";
    const body = mode === "fork" ? { sessionId, nodeId, modifier: text } : { sessionId, nodeId, fact: text };
    await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[480px] shadow-lg">
        <div className="flex gap-1 mb-4 border-b border-neutral-200">
          <button onClick={() => setMode("fork")} className={`px-3 py-2 text-sm ${mode === "fork" ? "border-b-2 border-neutral-900 -mb-px" : "text-neutral-500"}`}>Fork</button>
          <button onClick={() => setMode("inject")} className={`px-3 py-2 text-sm ${mode === "inject" ? "border-b-2 border-neutral-900 -mb-px" : "text-neutral-500"}`}>Inject fact</button>
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          {mode === "fork" ? "What should change from this point?" : "New fact to incorporate"}
        </div>
        <textarea
          className="w-full border border-neutral-300 rounded px-3 py-2 text-sm min-h-[100px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded text-neutral-600 hover:bg-neutral-100">Cancel</button>
          <button onClick={submit} disabled={!text.trim() || loading} className="px-3 py-1.5 text-sm rounded bg-neutral-900 text-white disabled:opacity-50">
            {loading ? "Working…" : mode === "fork" ? "Fork" : "Inject"}
          </button>
        </div>
      </div>
    </div>
  );
}
