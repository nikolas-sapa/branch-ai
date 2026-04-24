import { describe, it, expect } from "vitest";
import { structuredParse } from "../src/structured-parser.js";

describe("structuredParse", () => {
  it("returns null for very short input", async () => {
    const result = await structuredParse("short");
    expect(result).toBeNull();
  });

  it("returns a tree with children for multi-step reasoning", async () => {
    const rawThinking = `Let me think through whether to use SQLite or Postgres for a todo app.

First, consider the scale. A todo app has maybe 100-1000 users, each with under 1000 todos. That's well under 1M rows total.

SQLite handles this trivially. No separate server. Zero ops.

Postgres is designed for larger workloads. More setup, more knobs.

For a solo dev shipping fast, SQLite wins on simplicity. You can always migrate later if needed.

Conclusion: start with SQLite.`;
    const result = await structuredParse(rawThinking);
    expect(result).not.toBeNull();
    expect(result!.children.length).toBeGreaterThan(0);
    // Headline should be at the start of content
    expect(result!.content.length).toBeLessThan(200); // condensed, not raw paragraph
  }, 60_000);
});
