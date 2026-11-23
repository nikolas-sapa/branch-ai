import { describe, it, expect } from "vitest";
import { toMarkdown, toMermaid } from "../src/export.js";
import type { Tree } from "../src/tree.js";

const tree: Tree = {
  sessionId: "s1",
  prompt: "Pick a database",
  model: "sonnet",
  createdAt: "2026-01-01T00:00:00.000Z",
  finalText: "Use Postgres.",
  root: {
    id: "root",
    content: "Root",
    children: [
      {
        id: "n1",
        content: "Option \"A\": Postgres\nmature and boring",
        children: [{ id: "n2", content: "Supports JSONB", children: [] }],
      },
      { id: "n3", content: "Option B: Mongo", children: [] },
    ],
  },
};

describe("toMarkdown", () => {
  it("renders header, nested tree, and final answer", () => {
    const md = toMarkdown(tree);
    expect(md).toContain("**Prompt:** Pick a database");
    expect(md).toContain("**Model:** sonnet");
    expect(md).toContain("**Created:** 2026-01-01T00:00:00.000Z");
    const lines = md.split("\n");
    expect(lines).toContain("Root");
    expect(lines).toContain("  - Option \"A\": Postgres mature and boring");
    expect(lines).toContain("    - Supports JSONB");
    expect(lines).toContain("  - Option B: Mongo");
    expect(md.trimEnd().endsWith("## Final answer\n\nUse Postgres.")).toBe(true);
  });

  it("truncates long node content to 200 characters", () => {
    const long = "x".repeat(500);
    const md = toMarkdown({ ...tree, root: { id: "r", content: long, children: [] } });
    expect(md.split("\n")).toContain("x".repeat(200));
  });
});

describe("toMermaid", () => {
  it("emits a flowchart with one node line per node and one edge per child", () => {
    const lines = toMermaid(tree).split("\n");
    expect(lines[0]).toBe("flowchart TD");
    expect(lines).toContain("  root[\"Root\"]");
    expect(lines).toContain("  n1[\"Option A: Postgres\"]");
    expect(lines).toContain("  root --> n1");
    expect(lines).toContain("  n1 --> n2");
    expect(lines).toContain("  root --> n3");
    expect(lines.filter((l) => l.includes("-->"))).toHaveLength(3);
  });

  it("strips quotes and backslashes so labels cannot break out", () => {
    const out = toMermaid({ ...tree, root: { id: "r", content: "say \"hi\" \\ bye", children: [] } });
    expect(out).toContain("  r[\"say hi  bye\"]");
  });
});
