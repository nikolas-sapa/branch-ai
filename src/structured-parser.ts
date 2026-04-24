import { runClaude } from "./claude.js";
import { nanoid } from "nanoid";
import type { Node } from "./tree.js";

interface StructuredNode {
  headline: string;
  content: string;
  children?: StructuredNode[];
}

const STRUCTURING_PROMPT = (rawThinking: string) => `You are structuring a reasoning process into a tree.

Below is raw chain-of-thought text. Your job: reshape it into a hierarchical JSON tree of reasoning nodes. Each node has:
- "headline": a 3-5 word label summarizing that step ("weighing cost", "ruling out microservices", etc.)
- "content": the reasoning text itself (1-3 sentences max, condensed — you may rephrase for clarity, but preserve the original reasoning)
- "children": nested sub-nodes for dependent reasoning steps

Rules:
- Output ONLY valid JSON. No prose outside the JSON. No markdown code fences.
- Root must be an object with "headline", "content", "children"
- Tree depth 1-3 levels typically. Don't over-nest.
- Prefer breadth over depth when steps are siblings, not dependents.
- If the input is very short or unstructured, return a flat tree with one or two nodes.

RAW THINKING:
---
${rawThinking}
---

Output the JSON tree now:`;

function toNodeTree(structured: StructuredNode): Node {
  return {
    id: nanoid(8),
    content: structured.headline
      ? `${structured.headline}\n\n${structured.content}`
      : structured.content,
    children: (structured.children ?? []).map(toNodeTree),
    metadata: { kind: "heading" as const },
  };
}

export async function structuredParse(rawThinking: string): Promise<Node | null> {
  if (!rawThinking || rawThinking.length < 200) return null;
  try {
    const { finalText } = await runClaude({
      prompt: STRUCTURING_PROMPT(rawThinking),
      model: "haiku",
    });
    // Extract JSON — strip any leading/trailing whitespace or stray markdown
    const jsonMatch = finalText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed: StructuredNode = JSON.parse(jsonMatch[0]);
    if (!parsed.headline && !parsed.content) return null;
    return toNodeTree(parsed);
  } catch {
    return null;
  }
}
