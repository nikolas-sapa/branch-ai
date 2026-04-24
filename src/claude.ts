import { execa } from "execa";

export interface ClaudeRun {
  thinking: string;
  finalText: string;
  rawEvents: any[];
}

export async function runClaude(opts: {
  prompt: string;
  model?: "sonnet" | "opus" | "haiku";
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
