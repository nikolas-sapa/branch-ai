import type { Tree, Node } from "./tree.js";

function findPath(root: Node, targetId: string, acc: Node[] = []): Node[] | null {
  const path = [...acc, root];
  if (root.id === targetId) return path;
  for (const child of root.children) {
    const found = findPath(child, targetId, path);
    if (found) return found;
  }
  return null;
}

export function buildInjectPrompt(opts: {
  tree: Tree;
  nodeId: string;
  fact: string;
}): string {
  const path = findPath(opts.tree.root, opts.nodeId) ?? [];
  const priorReasoning = path.slice(1).map((n) => n.content).join("\n\n");

  return [
    `Original question: ${opts.tree.prompt}`,
    ``,
    `You previously reasoned as follows:`,
    priorReasoning,
    ``,
    `NEW FACT to incorporate: ${opts.fact}`,
    ``,
    `Re-examine the reasoning in light of this new fact. Think carefully through how this changes your conclusion.`,
  ].join("\n");
}
