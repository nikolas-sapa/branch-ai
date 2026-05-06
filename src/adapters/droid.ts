/**
 * Factory.ai Droid CLI adapter.
 *
 * ASSUMPTIONS (unverified — iterate when real Droid users test this):
 * - The `droid` binary is installed and on PATH.
 * - Output format flag: `droid --json "<prompt>"` (analogous to codex's `--json` flag).
 *   If Droid doesn't support `--json`, try `--output-format=json` (like claude) as fallback.
 *   ASSUMPTION: `--json` is the correct flag — update if Droid's CLI differs.
 * - Quiet/non-interactive flag: `--quiet` suppresses Droid's TUI (same as codex).
 *   ASSUMPTION: `--quiet` suppresses interactive UI — update if the flag name differs.
 * - Output format: line-delimited JSON (NDJSON), one event per line.
 * - Droid wraps multiple underlying models (GPT-4o, Claude, Gemini, etc.) via its own routing.
 *   When the underlying model emits reasoning/thinking, Droid may surface it in a block of:
 *   - `{ type: "thinking", content: string }` — Droid's own thinking wrapper
 *   - `{ type: "reasoning", content: string }` or `{ type: "reasoning", summary: [{text}] }` — OpenAI-style
 *   - `{ type: "thinking_block", thinking: string }` — Anthropic-style passthrough
 *   We handle all three shapes. If the underlying model doesn't expose reasoning, thinking stays "".
 * - Final text block: `{ type: "message", content: [{type:"text", text: string}] }`
 *   or `{ type: "output_text", text: string }` — we handle both.
 * - Model selection: Droid uses its own internal routing by default. Passing `--model default`
 *   lets Droid pick. Pass a specific model name to override (e.g. "gpt-4o", "claude-sonnet").
 *   ASSUMPTION: `-m <model>` or `--model <model>` is the model flag — update if different.
 * - `exposesThinking: true` — Droid *may* expose thinking when the underlying model supports it.
 *   In practice, if the routed model is non-reasoning, thinking will be empty string.
 *   The adapter always sets this to true and lets the output determine what's present.
 *
 * If the real droid binary differs, update the arg construction and block parsers below.
 * The adapter is safe to import when droid is not installed — available() returns false
 * and run/runStream throw a clear error.
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import type { ReasoningAdapter, StreamEvent } from "./types.js";

async function* runDroidStream(opts: {
  prompt: string;
  model?: string;
}): AsyncGenerator<StreamEvent> {
  // ASSUMPTION: droid --json --quiet -m <model> "<prompt>"
  // If droid uses `--output-format=json` instead of `--json`, update this line.
  const args: string[] = ["--json", "--quiet", opts.prompt];
  if (opts.model && opts.model !== "default") {
    args.splice(2, 0, "-m", opts.model);
  }

  const child = spawn("droid", args, { stdio: ["ignore", "pipe", "pipe"] });

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

        // ASSUMPTION: Droid's own thinking wrapper
        if (ev.type === "thinking" && typeof ev.content === "string") {
          const delta = ev.content.slice(fullThinking.length);
          if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
        }

        // ASSUMPTION: Anthropic-style thinking block passthrough (when underlying is Claude)
        if (ev.type === "thinking_block" && typeof ev.thinking === "string") {
          const delta = ev.thinking.slice(fullThinking.length);
          if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
        }

        // ASSUMPTION: OpenAI-style reasoning block (when underlying is o3/gpt-5)
        if (ev.type === "reasoning") {
          let chunk = "";
          if (typeof ev.content === "string") chunk = ev.content;
          else if (Array.isArray(ev.summary)) chunk = ev.summary.map((s: any) => s.text ?? "").join("");
          if (chunk) {
            const delta = chunk.slice(fullThinking.length);
            if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
          }
        }

        // ASSUMPTION: message block (structured content array)
        if (ev.type === "message" && Array.isArray(ev.content)) {
          for (const block of ev.content) {
            if (block.type === "text" && block.text) {
              const delta = block.text.slice(fullText.length);
              if (delta) { fullText += delta; yield { type: "text_delta", text: delta }; }
            }
          }
        }

        // ASSUMPTION: flat output_text event
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

export const droidAdapter: ReasoningAdapter = {
  name: "droid",
  label: "Factory.ai Droid",
  // exposesThinking: true — Droid routes across models; thinking is present only when the
  // underlying model supports it (e.g. Claude, o3). Set to true so Branch always attempts
  // to capture it; empty string is the graceful fallback when the routed model has no reasoning.
  exposesThinking: true,
  // ASSUMPTION: "default" signals Droid to use its own internal routing.
  // Pass a concrete model name (e.g. "gpt-4o", "claude-sonnet-4-5") to pin a model.
  defaultModel: "default",

  async available(): Promise<boolean> {
    try {
      execSync("which droid", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  },

  async run(opts: { prompt: string; model?: string }): Promise<{ thinking: string; finalText: string }> {
    if (!(await this.available())) {
      throw new Error(
        "droid binary not found on PATH. Install Factory.ai Droid CLI first: https://factory.ai"
      );
    }
    let thinking = "";
    let finalText = "";
    for await (const ev of runDroidStream(opts)) {
      if (ev.type === "thinking_delta") thinking += ev.text;
      if (ev.type === "text_delta") finalText += ev.text;
      if (ev.type === "done") { thinking = ev.full.thinking; finalText = ev.full.finalText; }
    }
    return { thinking, finalText };
  },

  async *runStream(opts: { prompt: string; model?: string }): AsyncGenerator<StreamEvent> {
    if (!(await this.available())) {
      throw new Error(
        "droid binary not found on PATH. Install Factory.ai Droid CLI first: https://factory.ai"
      );
    }
    yield* runDroidStream(opts);
  },
};
