import { describe, it, expect, vi } from "vitest";
import { buildForkPrompt, forkNode } from "../src/fork.js";
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

const forkTree = {
  root: { id: "root", content: "Root", children: [] },
  prompt: "Question", model: "sonnet", sessionId: "test", createdAt: "", finalText: "",
};
it("rejects an absent fork node before invoking the provider", async () => {
  const runClaude = vi.fn();
  expect(() => buildForkPrompt({ originalPrompt: "Question", tree: forkTree, forkNodeId: "missing", modifier: "change" })).toThrow(/node.*not found/i);
  await expect(forkNode({ tree: forkTree, forkNodeId: "missing", modifier: "change", runClaude })).rejects.toThrow(/node.*not found/i);
  expect(runClaude).not.toHaveBeenCalled();
});
it("allows a fork from the root", () => {
  expect(buildForkPrompt({ originalPrompt: "Question", tree: forkTree, forkNodeId: "root", modifier: "change" })).toContain("Question");
});
