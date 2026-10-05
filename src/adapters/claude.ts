/**
 * Claude Code adapter.
 * Spawns `claude --output-format=stream-json --verbose --print "<prompt>"`.
 * Exposes full thinking blocks from Claude's extended reasoning.
 */
import { processLines } from "./process.js";
import { execSync } from "node:child_process";
import type { ReasoningAdapter, StreamEvent } from "./types.js";

export type AllowedModel = "sonnet" | "opus" | "haiku";

export interface ClaudeRun {
  thinking: string;
  finalText: string;
  rawEvents: any[];
}

export async function* runClaudeStream(opts: {
  prompt: string;
  model?: AllowedModel | string;
}): AsyncGenerator<StreamEvent> {
  const args = [
    "--output-format=stream-json",
    "--verbose",
    "--print",
    opts.prompt,
  ];
  if (opts.model) args.push("--model", opts.model);

  let fullThinking = "";
  let fullText = "";

  for await (const line of processLines("claude", args)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const ev = JSON.parse(trimmed);
      if (ev.type === "assistant" && ev.message?.content) {
        for (const block of ev.message.content) {
          if (block.type === "thinking" && block.thinking) {
            const delta = block.thinking.slice(fullThinking.length);
            if (delta) { fullThinking += delta; yield { type: "thinking_delta", text: delta }; }
          }
          if (block.type === "text" && block.text) {
            const delta = block.text.slice(fullText.length);
            if (delta) { fullText += delta; yield { type: "text_delta", text: delta }; }
          }
        }
      }
    } catch { /* skip malformed */ }
  }

  yield { type: "done", full: { thinking: fullThinking, finalText: fullText } };
}

export async function runClaude(opts: {
  prompt: string;
  model?: AllowedModel | string;
  systemAppend?: string;
}): Promise<ClaudeRun> {
  const args = [
    "--output-format=stream-json",
    "--verbose",
    "--print",
    opts.prompt,
  ];
  if (opts.model) args.push("--model", opts.model);
  if (opts.systemAppend) args.push("--append-system-prompt", opts.systemAppend);

  const lines: string[] = [];
  for await (const line of processLines("claude", args)) {
    if (line.trim().startsWith("{")) lines.push(line);
  }
  const events = lines
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter((e): e is any => e !== null);

  let thinking = "";
  let finalText = "";
  for (const ev of events) {
    if (ev.type === "assistant" && ev.message?.content) {
      for (const block of ev.message.content) {
        if (block.type === "thinking") thinking += block.thinking ?? "";
        if (block.type === "text") finalText += block.text ?? "";
      }
    }
  }
  return { thinking, finalText, rawEvents: events };
}

export const claudeAdapter: ReasoningAdapter = {
  name: "claude",
  label: "Claude Code",
  exposesThinking: true,
  defaultModel: "sonnet",
  modelAliases: { sonnet: "sonnet", opus: "opus", haiku: "haiku" },

  async available(): Promise<boolean> {
    try {
      execSync("which claude", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  },

  async run(opts: { prompt: string; model?: string }): Promise<{ thinking: string; finalText: string }> {
    if (!(await this.available())) {
      throw new Error(
        "claude binary not found on PATH. Install Claude Code CLI first: https://docs.anthropic.com/en/docs/claude-code"
      );
    }
    const result = await runClaude({ prompt: opts.prompt, model: opts.model });
    return { thinking: result.thinking, finalText: result.finalText };
  },

  async *runStream(opts: { prompt: string; model?: string }): AsyncGenerator<StreamEvent> {
    if (!(await this.available())) {
      throw new Error(
        "claude binary not found on PATH. Install Claude Code CLI first: https://docs.anthropic.com/en/docs/claude-code"
      );
    }
    yield* runClaudeStream({ prompt: opts.prompt, model: opts.model });
  },
};
