import { describe, it, expect } from "vitest";
import { parseThinking } from "../src/parser.js";

describe("parseThinking", () => {
  it("splits bold section headers into nodes", () => {
    const thinking = `Let me think.

**Option A: Bus**
- Takes 45 minutes
- Uncertain timing

**Option B: Taxi**
- Takes 30 minutes
- Door to door

Conclusion: taxi.`;
    const root = parseThinking(thinking);
    expect(root.children.length).toBeGreaterThanOrEqual(2);
    expect(root.children.some((c) => c.content.includes("Bus"))).toBe(true);
    expect(root.children.some((c) => c.content.includes("Taxi"))).toBe(true);
  });

  it("returns a single-node tree for unstructured thinking", () => {
    const root = parseThinking("Just a single paragraph with no structure.");
    expect(root.children.length).toBe(1);
  });
});
