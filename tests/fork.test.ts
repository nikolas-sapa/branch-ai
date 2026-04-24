import { describe, it, expect } from "vitest";
import { buildForkPrompt } from "../src/fork.js";
import type { Node } from "../src/tree.js";

describe("buildForkPrompt", () => {
  it("includes path-to-node context and modifier in the fork prompt", () => {
    const root: Node = {
      id: "r",
      content: "Root",
      children: [
        { id: "a", content: "Considered option A: taxi", children: [] },
        { id: "b", content: "Considered option B: bus", children: [] },
      ],
    };
    const prompt = buildForkPrompt({
      originalPrompt: "How to get to airport?",
      tree: { root, prompt: "", model: "sonnet", sessionId: "", createdAt: "", finalText: "" },
      forkNodeId: "b",
      modifier: "what if cost is not a factor",
    });
    expect(prompt).toContain("How to get to airport?");
    expect(prompt).toContain("option B: bus");
    expect(prompt).toContain("cost is not a factor");
  });
});
