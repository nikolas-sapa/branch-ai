import { describe, it, expect } from "vitest";
import { runClaude } from "../src/claude.js";

describe("runClaude", () => {
  it("returns thinking blocks from a structured prompt", async () => {
    const result = await runClaude({
      prompt: "Think carefully: should I take a taxi or bus to the airport in 90 minutes, 15km away, during rush hour?",
      model: "sonnet",
    });
    expect(result.thinking).toBeTruthy();
    expect(result.thinking.length).toBeGreaterThan(100);
    expect(result.finalText).toBeTruthy();
  }, 60_000);
});
