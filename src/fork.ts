import type { Node, Tree } from "./tree.js";

function findPath(root: Node, targetId: string, acc: Node[] = []): Node[] | null {
  const path = [...acc, root];
  if (root.id === targetId) return path;
  for (const child of root.children) {
    const found = findPath(child, targetId, path);
    if (found) return found;
  }
  return null;
}

export function buildForkPrompt(opts: {
  originalPrompt: string;
  tree: Tree;
  forkNodeId: string;
  modifier: string;
}): string {
  const path = findPath(opts.tree.root, opts.forkNodeId) ?? [];
  const priorReasoning = path
    .slice(1)
    .map((n) => n.content)
    .join("\n\n");

  return [
    `Original question: ${opts.originalPrompt}`,
    ``,
    `You previously reasoned as follows up to a point:`,
    priorReasoning,
    ``,
    `Now re-examine the decision from this point, but with this change: ${opts.modifier}`,
    ``,
    `Think carefully through the implications and arrive at a new conclusion.`,
  ].join("\n");
}

export async function forkNode(opts: {
  tree: Tree;
  forkNodeId: string;
  modifier: string;
  runClaude: (p: { prompt: string; model: string }) => Promise<{ thinking: string; finalText: string }>;
}): Promise<{ thinking: string; finalText: string }> {
  const prompt = buildForkPrompt({
    originalPrompt: opts.tree.prompt,
    tree: opts.tree,
    forkNodeId: opts.forkNodeId,
    modifier: opts.modifier,
  });
  return opts.runClaude({ prompt, model: opts.tree.model });
}
