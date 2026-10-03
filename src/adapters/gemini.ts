/**
 * Google Gemini CLI adapter.
 *
 * ASSUMPTIONS (unverified — iterate when real users test with gemini):
 * - The `gemini` CLI accepts `-p "<prompt>"` or `--prompt "<prompt>"` to run non-interactively.
 * - With thinking-mode models (Gemini 2.5 Flash, Gemini 2.5 Pro), the CLI may expose
 *   reasoning blocks. We attempt to parse them if present.
 * - The CLI can be instructed to produce JSON with `--json` or `--output json`.
 *   If JSON output is unavailable, we fall back to plain stdout as finalText.
 * - JSON block shapes (when available):
 *     Thinking: `{ type: "thinking", text: string }` or `{ thinking: string }`
 *     Text:     `{ type: "text", text: string }` or `{ text: string }`
 * - Models: "gemini-2.5-flash", "gemini-2.5-pro". Default: "gemini-2.5-flash".
 * - If the real gemini binary differs, update arg construction and parsers here.
 *
 * The adapter is safe to import when gemini is not installed — available() returns false
 * and run/runStream throw a clear error.
 */
import { processLines } from "./process.js";
import { execSync } from "node:child_process";
import type { ReasoningAdapter, StreamEvent } from "./types.js";

async function* runGeminiStream(opts: {
  prompt: string;
  model?: string;
}): AsyncGenerator<StreamEvent> {
  // ASSUMPTION: gemini -p "<prompt>" [--model <model>]
  // Try JSON mode first; fall back to plain text
  const args = ["-p", opts.prompt];
  if (opts.model) args.push("--model", opts.model);

  let fullThinking = "";
  let fullText = "";

  for await (const line of processLines("gemini", args)) {
    const trimmed = line.trim();
    // Try to parse as JSON; fall through to plain-text accumulation
    if (trimmed.startsWith("{")) {
      try {
        const ev = JSON.parse(trimmed);
        // ASSUMPTION: thinking block
        if (ev.type === "thinking" && typeof ev.text === "string") {
          const delta = ev.text.slice(fullThinking.length);
          if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
        } else if (typeof ev.thinking === "string") {
          const delta = ev.thinking.slice(fullThinking.length);
          if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
        }
        // ASSUMPTION: text block
        if (ev.type === "text" && typeof ev.text === "string") {
          const delta = ev.text.slice(fullText.length);
          if (delta) { fullText += delta; yield { type: "text_delta", text: delta }; }
        } else if (ev.type !== "thinking" && typeof ev.text === "string") {
          const delta = ev.text.slice(fullText.length);
          if (delta) { fullText += delta; yield { type: "text_delta", text: delta }; }
        }
        continue;
      } catch { /* not JSON — fall through to plain text */ }
    }
    // Plain text line — accumulate as final text
    if (trimmed) {
      const lineWithNl = line;
      fullText += lineWithNl;
      yield { type: "text_delta", text: lineWithNl };
    }
  }

  yield { type: "done", full: { thinking: fullThinking, finalText: fullText } };
}

export const geminiAdapter: ReasoningAdapter = {
  name: "gemini",
  label: "Google Gemini CLI",
  exposesThinking: false, // may be true with Flash thinking; updated as confirmed
  defaultModel: "gemini-2.5-flash",
  modelAliases: {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
  },

  async available(): Promise<boolean> {
    try {
      execSync("which gemini", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  },

  async run(opts: { prompt: string; model?: string }): Promise<{ thinking: string; finalText: string }> {
    if (!(await this.available())) {
      throw new Error(
        "gemini binary not found on PATH. Install it: https://github.com/google-gemini/gemini-cli"
      );
    }
    let thinking = "";
    let finalText = "";
    for await (const ev of runGeminiStream(opts)) {
      if (ev.type === "thinking_delta") thinking += ev.text;
      if (ev.type === "text_delta") finalText += ev.text;
      if (ev.type === "done") { thinking = ev.full.thinking; finalText = ev.full.finalText; }
    }
    return { thinking, finalText };
  },

  async *runStream(opts: { prompt: string; model?: string }): AsyncGenerator<StreamEvent> {
    if (!(await this.available())) {
      throw new Error(
        "gemini binary not found on PATH. Install it: https://github.com/google-gemini/gemini-cli"
      );
    }
    yield* runGeminiStream(opts);
  },
};
