import { describe, it, expect } from "vitest";
import { diffTrees, diffSummary } from "../src/diff.js";
import { diffTrees as viewerDiffTrees } from "../viewer/lib/diff.js";
import type { Node } from "../src/tree.js";

const rootA: Node = {
  id: "ra",
  content: "Should we deploy on Friday?",
  children: [
    { id: "a1", content: "Deploy risk rises before the weekend because on-call coverage is thin", children: [] },
    { id: "a2", content: "Rollback tooling is mature and fast", children: [] },
    { id: "a3", content: "Customer traffic peaks on Friday evenings", children: [] },
  ],
};

const rootB: Node = {
  id: "rb",
  content: "Should we deploy on Friday?",
  children: [
    { id: "b1", content: "Deploy risk rises before the weekend because on-call coverage is thin", children: [] },
    { id: "b2", content: "Rollback tooling is mature and very fast", children: [] },
    { id: "b3", content: "Feature flags let us ship dark and enable Monday", children: [] },
  ],
};

describe("diffTrees", () => {
  it("classifies identical, similar, and unmatched children", () => {
    const diff = diffTrees(rootA, rootB);
    expect(diff.status).toBe("shared");
    expect(diff.id).toBe("ra::rb");

    const byId = Object.fromEntries(diff.children.map((c) => [c.id, c]));
    expect(byId["a1::b1"].status).toBe("shared");
    expect(byId["a2::b2"].status).toBe("changed");
    expect(byId["a2::b2"].contentA).toBe("Rollback tooling is mature and fast");
    expect(byId["a2::b2"].contentB).toBe("Rollback tooling is mature and very fast");
    expect(byId["a::a3"].status).toBe("only-a");
    expect(byId["b::b3"].status).toBe("only-b");
    expect(diff.children).toHaveLength(4);
  });

  it("marks whole unmatched subtrees as one-sided", () => {
    const a: Node = { id: "r", content: "Root", children: [] };
    const b: Node = {
      id: "r",
      content: "Root",
      children: [
        { id: "x", content: "Brand new branch", children: [{ id: "y", content: "Nested step", children: [] }] },
      ],
    };
    const diff = diffTrees(a, b);
    expect(diff.children).toHaveLength(1);
    expect(diff.children[0].status).toBe("only-b");
    expect(diff.children[0].children[0]).toMatchObject({ id: "b::y", status: "only-b", contentB: "Nested step" });
  });

  it("matches each B child at most once", () => {
    const a: Node = {
      id: "r",
      content: "Root",
      children: [
        { id: "a1", content: "Same text here", children: [] },
        { id: "a2", content: "Same text here", children: [] },
      ],
    };
    const b: Node = { id: "r", content: "Root", children: [{ id: "b1", content: "Same text here", children: [] }] };
    const statuses = diffTrees(a, b).children.map((c) => c.status).sort();
    expect(statuses).toEqual(["only-a", "shared"]);
  });

  it("stays in sync with the viewer copy in viewer/lib/diff.ts", () => {
    expect(diffTrees(rootA, rootB)).toEqual(viewerDiffTrees(rootA, rootB));
    expect(diffTrees(rootB, rootA)).toEqual(viewerDiffTrees(rootB, rootA));
  });
});

describe("diffSummary", () => {
  it("counts every status and collects samples", () => {
    const summary = diffSummary(diffTrees(rootA, rootB));
    expect(summary).toMatchObject({ shared: 2, changed: 1, onlyA: 1, onlyB: 1 });
    expect(summary.samples.changed).toEqual(["Rollback tooling is mature and fast"]);
    expect(summary.samples.onlyA).toEqual(["Customer traffic peaks on Friday evenings"]);
    expect(summary.samples.onlyB).toEqual(["Feature flags let us ship dark and enable Monday"]);
  });

  it("caps samples at five per bucket and flattens newlines", () => {
    const a: Node = { id: "r", content: "Root", children: [] };
    const b: Node = {
      id: "r",
      content: "Root",
      children: Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, content: `line ${i}\nmore ${i}`, children: [] })),
    };
    const summary = diffSummary(diffTrees(a, b));
    expect(summary.onlyB).toBe(7);
    expect(summary.samples.onlyB).toHaveLength(5);
    expect(summary.samples.onlyB[0]).toBe("line 0 more 0");
  });
});
