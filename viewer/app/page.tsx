"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("sonnet");
  const [streaming, setStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || streaming) return;

    setStreaming(true);
    setThinkingText("");
    setStatus("Connecting...");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model }),
        signal: abort.signal,
      });

      if (!res.ok) {
        setStatus(`Error: ${res.statusText}`);
        setStreaming(false);
        return;
      }

      setStatus("Thinking...");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let partial = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        partial += decoder.decode(value, { stream: true });
        const parts = partial.split("\n\n");
        partial = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.startsWith("data: ") ? part.slice(6) : part;
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "thinking_delta") {
              setThinkingText((t) => t + ev.text);
            } else if (ev.type === "done") {
              setStatus("Done.");
              setTimeout(() => {
                router.refresh();
                setStreaming(false);
                setStatus("");
                setThinkingText("");
                setPrompt("");
              }, 1200);
            } else if (ev.type === "error") {
              setStatus(`Error: ${ev.message}`);
              setStreaming(false);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setStatus(`Error: ${err.message}`);
      }
      setStreaming(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus("");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Branch</h1>
          <p className="text-neutral-500 text-sm">
            Ask a question and watch the reasoning tree build in real time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm
                       placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300
                       resize-none disabled:opacity-50"
            rows={4}
            placeholder='e.g. "Weigh the tradeoffs: rebuild vs refactor a 3-year-old codebase?"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={streaming}
          />

          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={streaming}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50"
            >
              <option value="sonnet">sonnet</option>
              <option value="opus">opus</option>
              <option value="haiku">haiku</option>
            </select>

            {streaming ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2 rounded-md bg-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-300 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="px-5 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium
                           hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Think
              </button>
            )}

            {status && (
              <span className="text-sm text-neutral-500">{status}</span>
            )}
          </div>
        </form>

        {thinkingText && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 max-h-64 overflow-y-auto">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Thinking
            </p>
            <pre className="text-xs text-neutral-600 whitespace-pre-wrap font-mono leading-relaxed">
              {thinkingText}
            </pre>
          </div>
        )}

        <div className="text-center text-xs text-neutral-400">
          Or run{" "}
          <code className="bg-neutral-200 rounded px-1 py-0.5">
            branch &quot;your question&quot;
          </code>{" "}
          in your terminal — both save to the same session store.
        </div>
      </div>
    </main>
  );
}
