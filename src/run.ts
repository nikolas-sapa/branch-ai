import { nanoid } from "nanoid";
import { runClaude, runClaudeStream } from "./claude.js";
import type { AllowedModel } from "./claude.js";
import { parseThinking } from "./parser.js";
import { structuredParse } from "./structured-parser.js";
import { saveSession } from "./session.js";
import type { Tree, Node } from "./tree.js";

export function countNodes(n: Node): number {
  return 1 + n.children.reduce((a: number, c: Node) => a + countNodes(c), 0);
}

export async function* branchStream(
  prompt: string,
  opts: { model?: AllowedModel } = {}
): AsyncGenerator<
  | { type: "start"; sessionId: string }
  | { type: "thinking_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tree_update"; root: Node }
  | { type: "done"; tree: Tree }
> {
  const model = opts.model ?? "sonnet";
  const sessionId = nanoid(10);
  const createdAt = new Date().toISOString();
  yield { type: "start", sessionId };

  let fullThinking = "";
  let fullText = "";
  let lastPartialSave = Date.now();
  const PARTIAL_SAVE_INTERVAL_MS = 4000;

  // Keep track of the latest partial tree for SIGINT handler
  let currentPartialTree: Tree | null = null;

  const sigintHandler = async () => {
    if (currentPartialTree) {
      await saveSession({ ...currentPartialTree, incomplete: true }).catch(() => {});
    }
    process.exit(130);
  };
  process.once("SIGINT", sigintHandler);

  try {
    for await (const ev of runClaudeStream({ prompt, model })) {
      if (ev.type === "thinking_delta") {
        const prevLen = fullThinking.length;
        fullThinking += ev.text;
        yield { type: "thinking_delta", text: ev.text };
        // Emit a tree_update approximately every 200 chars of new thinking
        const crossedBoundary = Math.floor(fullThinking.length / 200) > Math.floor(prevLen / 200);
        if (crossedBoundary) {
          const root = parseThinking(fullThinking);
          yield { type: "tree_update", root };
          // Periodic partial save every ~4 seconds
          if (Date.now() - lastPartialSave >= PARTIAL_SAVE_INTERVAL_MS) {
            currentPartialTree = { sessionId, prompt, model, createdAt, root, finalText: fullText, incomplete: true };
            await saveSession(currentPartialTree).catch(() => {});
            lastPartialSave = Date.now();
          }
        }
      } else if (ev.type === "text_delta") {
        fullText += ev.text;
        yield { type: "text_delta", text: ev.text };
      } else if (ev.type === "done") {
        fullThinking = ev.full.thinking;
        fullText = ev.full.finalText;
      }
    }
  } finally {
    process.off("SIGINT", sigintHandler);
  }

  const root = parseThinking(fullThinking);
  const tree: Tree = {
    sessionId,
    prompt,
    model,
    createdAt,
    root,
    finalText: fullText,
    incomplete: false,
  };
  await saveSession(tree);
  yield { type: "done", tree };
}

export async function branch(
  prompt: string,
  opts: { model?: AllowedModel; structured?: boolean } = {}
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
