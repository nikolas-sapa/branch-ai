import type { Tree, Node } from "./tree.js";

export function toMarkdown(tree: Tree): string {
  const lines: string[] = [];
  lines.push(`# Branch reasoning session`);
  lines.push("");
  lines.push(`**Prompt:** ${tree.prompt}`);
  lines.push(`**Model:** ${tree.model}`);
  lines.push(`**Created:** ${tree.createdAt}`);
  lines.push("");
  lines.push(`## Reasoning tree`);
  lines.push("");
  function walk(n: Node, depth: number) {
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "" : "- ";
    lines.push(`${indent}${prefix}${n.content.replace(/\n/g, " ").slice(0, 200)}`);
    for (const c of n.children) walk(c, depth + 1);
  }
  walk(tree.root, 0);
  lines.push("");
  lines.push(`## Final answer`);
  lines.push("");
  lines.push(tree.finalText);
  return lines.join("\n");
}

export function toMermaid(tree: Tree): string {
  const lines: string[] = ["flowchart TD"];
  function label(n: Node): string {
    const text = n.content.split("\n")[0].slice(0, 60).replace(/["\\]/g, "");
    return `${n.id}["${text}"]`;
  }
  function walk(n: Node) {
    lines.push(`  ${label(n)}`);
    for (const c of n.children) {
      lines.push(`  ${n.id} --> ${c.id}`);
      walk(c);
    }
  }
  walk(tree.root);
  return lines.join("\n");
}
