import { describe, it, expect } from "vitest";
import { buildInjectPrompt } from "../src/inject.js";
import type { Tree } from "../src/tree.js";

const tree: Tree = {
  sessionId: "s",
  prompt: "Should I deploy on Friday?",
  model: "sonnet",
  createdAt: "",
  finalText: "",
  root: {
    id: "r",
    content: "Root",
    children: [
      { id: "a", content: "Friday deploys are risky.", children: [] },
    ],
  },
};

describe("buildInjectPrompt", () => {
  it("embeds the injected fact with the prior reasoning", () => {
    const prompt = buildInjectPrompt({
      tree,
      nodeId: "a",
      fact: "Our team just added end-to-end tests with 95% coverage.",
    });
    expect(prompt).toContain("Should I deploy on Friday?");
    expect(prompt).toContain("Friday deploys are risky");
    expect(prompt).toContain("end-to-end tests with 95% coverage");
  });
});
