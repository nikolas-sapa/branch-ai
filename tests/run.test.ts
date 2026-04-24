import { describe, it, expect } from "vitest";
import { branch } from "../src/index.js";

describe("branch() end-to-end", () => {
  it("runs a prompt, parses tree, saves session, returns Tree", async () => {
    const tree = await branch("Think: is 7 a prime number?", { model: "sonnet" });
    expect(tree.sessionId).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(tree.root.children.length).toBeGreaterThan(0);
    expect(tree.finalText.length).toBeGreaterThan(0);
  }, 60_000);
});
