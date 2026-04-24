import { nanoid } from "nanoid";
import { runClaude } from "./claude.js";
import { parseThinking } from "./parser.js";
import { saveSession } from "./session.js";
import type { Tree } from "./tree.js";

export async function branch(
  prompt: string,
  opts: { model?: "sonnet" | "opus" | "haiku" } = {}
): Promise<Tree> {
  const model = opts.model ?? "sonnet";
  const result = await runClaude({ prompt, model });
  const root = parseThinking(result.thinking);

  const tree: Tree = {
    sessionId: nanoid(10),
    prompt,
    model,
    createdAt: new Date().toISOString(),
    root,
    finalText: result.finalText,
  };

  await saveSession(tree);
  return tree;
}
