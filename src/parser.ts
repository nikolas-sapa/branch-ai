import { nanoid } from "nanoid";
import type { Node } from "./tree.js";

const BOLD_HEADER = /^\*\*([^*]+)\*\*:?\s*$/;
const OPTION_HEADER = /^(Option\s+\w+|Approach\s+\w+|Alternative\s+\w+):?\s/i;

export function parseThinking(thinking: string): Node {
  const root: Node = {
    id: nanoid(8),
    content: "Reasoning",
    children: [],
    metadata: { kind: "root" },
  };

  const paragraphs = thinking
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let current: Node = root;

  for (const para of paragraphs) {
    const firstLine = para.split("\n")[0];
    const isHeading = BOLD_HEADER.test(firstLine) || OPTION_HEADER.test(firstLine);

    if (isHeading) {
      current = {
        id: nanoid(8),
        content: para,
        children: [],
        metadata: { kind: "heading" },
      };
      root.children.push(current);
    } else {
      const node: Node = {
        id: nanoid(8),
        content: para,
        children: [],
        metadata: { kind: "paragraph" },
      };
      current.children.push(node);
    }
  }

  if (root.children.length === 0) {
    root.children.push({
      id: nanoid(8),
      content: thinking,
      children: [],
      metadata: { kind: "paragraph" },
    });
  }

  return root;
}
