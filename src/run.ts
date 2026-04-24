import { nanoid } from "nanoid";
import { runClaude } from "./claude.js";
import { parseThinking } from "./parser.js";
import { structuredParse } from "./structured-parser.js";
import { saveSession } from "./session.js";
import type { Tree, Node } from "./tree.js";

function countNodes(n: Node): number {
  return 1 + n.children.reduce((a: number, c: Node) => a + countNodes(c), 0);
}

export async function branch(
  prompt: string,
  opts: { model?: "sonnet" | "opus" | "haiku"; structured?: boolean } = {}
): Promise<Tree> {
  const model = opts.model ?? "sonnet";
  const useStructured = opts.structured !== false; // default ON
  const result = await runClaude({ prompt, model });

  const heuristicRoot = parseThinking(result.thinking);
  let root = heuristicRoot;

  if (useStructured) {
    const structuredRoot = await structuredParse(result.thinking);
    // Prefer structured if it has more nodes
    if (structuredRoot && countNodes(structuredRoot) > countNodes(heuristicRoot)) {
      root = structuredRoot;
    }
  }

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
