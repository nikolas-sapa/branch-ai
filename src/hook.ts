#!/usr/bin/env node
import { saveSession } from "./session.js";
import type { Tree } from "./tree.js";
import { nanoid } from "nanoid";

// Claude Code Stop hook receives session metadata via stdin (JSON).
// We read the last user prompt + assistant final response and save as a Branch session.

async function main() {
  const stdin = await readStdin();
  let data: any = {};
  try { data = JSON.parse(stdin); } catch { /* graceful no-op */ }

  const transcript: any[] = data.transcript ?? data.messages ?? [];
  if (!Array.isArray(transcript) || transcript.length < 2) return;

  // Find last user message and last assistant message with reasoning
  const lastUser = [...transcript].reverse().find((m) => m.role === "user")?.content ?? "";
  const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");
  if (!lastUser || !lastAssistant) return;

  const userPrompt = typeof lastUser === "string" ? lastUser : (lastUser[0]?.text ?? JSON.stringify(lastUser).slice(0, 500));

  // Extract thinking from assistant content blocks if present
  const blocks: any[] = Array.isArray(lastAssistant.content) ? lastAssistant.content : [];
  const thinking = blocks.filter((b) => b.type === "thinking").map((b) => b.thinking).join("\n\n");
  const finalText = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n\n");

  if (!thinking && !finalText) return;

  // Build a tree directly without re-invoking claude (we already have the data)
  const { parseThinking } = await import("./parser.js");
  const root = parseThinking(thinking || finalText);

  const tree: Tree = {
    sessionId: nanoid(10),
    prompt: typeof userPrompt === "string" ? userPrompt.slice(0, 500) : JSON.stringify(userPrompt).slice(0, 500),
    model: data.model ?? "sonnet",
    createdAt: new Date().toISOString(),
    root,
    finalText,
    tags: ["watched"],
  };
  await saveSession(tree);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.on("data", (c) => { data += c.toString(); });
    process.stdin.on("end", () => resolve(data));
  });
}

main().catch(() => process.exit(0)); // hooks must never block CC
