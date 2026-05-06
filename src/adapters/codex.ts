/**
 * OpenAI Codex CLI adapter.
 *
 * ASSUMPTIONS (unverified — iterate when real users test with codex):
 * - The `codex` CLI accepts `--json` flag (or `--output-format json`) and
 *   `--quiet` to suppress interactive UI, similar to `claude --output-format=stream-json`.
 * - With o3/gpt-5 models, the JSON output includes `reasoning` blocks alongside
 *   `message` blocks, following OpenAI's published streaming format:
 *   https://github.com/openai/codex
 * - Line-delimited JSON (NDJSON) output, one event per line.
 * - A `reasoning` block has shape: `{ type: "reasoning", summary: [{ text: string }] }`
 *   or `{ type: "reasoning", content: string }` — we handle both.
 * - A `message` block has shape: `{ type: "message", content: [{ type: "text", text: string }] }`
 *   or `{ type: "output_text", text: string }`.
 * - Models: "o3", "o4-mini", "gpt-4o" are common. Default: "o3".
 *
 * If the real codex binary differs, update the arg construction and block parsers here.
 * The adapter is safe to import when codex is not installed — available() returns false
 * and run/runStream throw a clear error.
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import type { ReasoningAdapter, StreamEvent } from "./types.js";

async function* runCodexStream(opts: {
  prompt: string;
  model?: string;
}): AsyncGenerator<StreamEvent> {
  // ASSUMPTION: codex --json --quiet -m <model> "<prompt>"
  const args = ["--json", "--quiet", opts.prompt];
  if (opts.model) args.splice(2, 0, "-m", opts.model);

  const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });

  let buffer = "";
  let fullThinking = "";
  let fullText = "";

  const chunks: Buffer[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  child.stdout!.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    if (resolve) { resolve(); resolve = null; }
  });
  child.stdout!.on("end", () => {
    done = true;
    if (resolve) { resolve(); resolve = null; }
  });

  const nextChunk = (): Promise<void> =>
    new Promise((res) => { resolve = res; });

  while (true) {
    while (chunks.length > 0) {
      buffer += chunks.shift()!.toString();
    }
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const ev = JSON.parse(trimmed);
        // ASSUMPTION: reasoning block formats
        if (ev.type === "reasoning") {
          let chunk = "";
          if (typeof ev.content === "string") chunk = ev.content;
          else if (Array.isArray(ev.summary)) chunk = ev.summary.map((s: any) => s.text ?? "").join("");
          if (chunk) {
            const delta = chunk.slice(fullThinking.length);
            if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
          }
        }
        // ASSUMPTION: message/output block formats
        if (ev.type === "message" && Array.isArray(ev.content)) {
          for (const block of ev.content) {
            if (block.type === "text" && block.text) {
              const delta = block.text.slice(fullText.length);
              if (delta) { fullText += delta; yield { type: "text_delta", text: delta }; }
            }
          }
        }
        if (ev.type === "output_text" && typeof ev.text === "string") {
          const delta = ev.text.slice(fullText.length);
          if (delta) { fullText += delta; yield { type: "text_delta", text: delta }; }
        }
      } catch { /* skip malformed */ }
    }
    if (done && chunks.length === 0) break;
    await nextChunk();
  }

  yield { type: "done", full: { thinking: fullThinking, finalText: fullText } };
}

export const codexAdapter: ReasoningAdapter = {
  name: "codex",
  label: "OpenAI Codex CLI",
  exposesThinking: true, // o3/gpt-5 expose reasoning summaries
  defaultModel: "o3",
  modelAliases: { o3: "o3", "o4-mini": "o4-mini", "gpt-4o": "gpt-4o" },

  async available(): Promise<boolean> {
    try {
      execSync("which codex", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  },

  async run(opts: { prompt: string; model?: string }): Promise<{ thinking: string; finalText: string }> {
    if (!(await this.available())) {
      throw new Error(
        "codex binary not found on PATH. Install it: https://github.com/openai/codex"
      );
    }
    let thinking = "";
    let finalText = "";
    for await (const ev of runCodexStream(opts)) {
      if (ev.type === "thinking_delta") thinking += ev.text;
      if (ev.type === "text_delta") finalText += ev.text;
      if (ev.type === "done") { thinking = ev.full.thinking; finalText = ev.full.finalText; }
    }
    return { thinking, finalText };
  },

  async *runStream(opts: { prompt: string; model?: string }): AsyncGenerator<StreamEvent> {
    if (!(await this.available())) {
      throw new Error(
        "codex binary not found on PATH. Install it: https://github.com/openai/codex"
      );
    }
    yield* runCodexStream(opts);
  },
};
