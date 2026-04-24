import { execa } from "execa";
import { spawn } from "node:child_process";

export interface ClaudeRun {
  thinking: string;
  finalText: string;
  rawEvents: any[];
}

export type AllowedModel = "sonnet" | "opus" | "haiku";

export type StreamEvent =
  | { type: "thinking_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "done"; full: { thinking: string; finalText: string } };

export async function* runClaudeStream(opts: {
  prompt: string;
  model?: AllowedModel;
}): AsyncGenerator<StreamEvent> {
  const args = [
    "--output-format=stream-json",
    "--verbose",
    "--print",
    opts.prompt,
  ];
  if (opts.model) args.push("--model", opts.model);

  const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });

  let buffer = "";
  let fullThinking = "";
  let fullText = "";

  // Collect chunks into an async iterable
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
    if (done && chunks.length === 0) break;
    await nextChunk();
  }

  // Flush remaining buffer
  if (buffer.trim().startsWith("{")) {
    try {
      const ev = JSON.parse(buffer.trim());
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
    } catch { /* ignore */ }
  }

  yield { type: "done", full: { thinking: fullThinking, finalText: fullText } };
}

export async function runClaude(opts: {
  prompt: string;
  model?: AllowedModel;
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

  const { stdout } = await execa("claude", args, { reject: false });
  const lines = stdout.split("\n").filter((l) => l.trim().startsWith("{"));
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
