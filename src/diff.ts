// Mirror of viewer/lib/diff.ts — kept in sync manually.
// This version runs in the SDK/MCP context (no Next.js / React dependency).

import type { Node } from "./tree.js";

export type DiffStatus = "shared" | "only-a" | "only-b" | "changed";

export interface DiffNode {
  id: string;
  status: DiffStatus;
  contentA?: string;
  contentB?: string;
  children: DiffNode[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function contentSim(a: string, b: string): number {
  return jaccard(tokenize(a), tokenize(b));
}

export function diffTrees(rootA: Node, rootB: Node): DiffNode {
  const SIM_THRESHOLD = 0.6;

  function match(a: any, b: any): DiffNode {
    const aChildren = [...(a.children ?? [])];
    const bChildren = [...(b.children ?? [])];
    const matchedPairs: Array<[any, any]> = [];
    const usedB = new Set<number>();

    for (const ac of aChildren) {
      let best: { idx: number; sim: number } | null = null;
      for (let i = 0; i < bChildren.length; i++) {
        if (usedB.has(i)) continue;
        const sim = contentSim(ac.content ?? "", bChildren[i].content ?? "");
        if (sim >= SIM_THRESHOLD && (!best || sim > best.sim)) {
          best = { idx: i, sim };
        }
      }
      if (best) {
        matchedPairs.push([ac, bChildren[best.idx]]);
        usedB.add(best.idx);
      }
    }

    const unmatchedA = aChildren.filter(
      (c) => !matchedPairs.some(([ap]) => ap === c)
    );
    const unmatchedB = bChildren.filter((_, i) => !usedB.has(i));

    const diffChildren: DiffNode[] = [
      ...matchedPairs.map(([ac, bc]) => match(ac, bc)),
      ...unmatchedA.map((c) => onlyA(c)),
      ...unmatchedB.map((c) => onlyB(c)),
    ];

    const contentEq =
      (a.content ?? "").trim() === (b.content ?? "").trim();
    return {
      id: `${a.id}::${b.id}`,
      status: contentEq ? "shared" : "changed",
      contentA: a.content,
      contentB: b.content,
      children: diffChildren,
    };
  }

  function onlyA(n: any): DiffNode {
    return {
      id: `a::${n.id}`,
      status: "only-a",
      contentA: n.content,
      children: (n.children ?? []).map(onlyA),
    };
  }

  function onlyB(n: any): DiffNode {
    return {
      id: `b::${n.id}`,
      status: "only-b",
      contentB: n.content,
      children: (n.children ?? []).map(onlyB),
    };
  }

  return match(rootA, rootB);
}

export interface DiffSummary {
  shared: number;
  changed: number;
  onlyA: number;
  onlyB: number;
  samples: {
    changed: string[];
    onlyA: string[];
    onlyB: string[];
  };
}

export function diffSummary(diff: DiffNode): DiffSummary {
  const counts = { shared: 0, changed: 0, onlyA: 0, onlyB: 0 };
  const samples: DiffSummary["samples"] = { changed: [], onlyA: [], onlyB: [] };

  function walk(node: DiffNode): void {
    counts[node.status === "only-a" ? "onlyA" : node.status === "only-b" ? "onlyB" : node.status]++;

    if (node.status === "changed" && samples.changed.length < 5) {
      const snippet = (node.contentA ?? "").slice(0, 120).replace(/\n/g, " ");
      samples.changed.push(snippet);
    } else if (node.status === "only-a" && samples.onlyA.length < 5) {
      const snippet = (node.contentA ?? "").slice(0, 120).replace(/\n/g, " ");
      samples.onlyA.push(snippet);
    } else if (node.status === "only-b" && samples.onlyB.length < 5) {
      const snippet = (node.contentB ?? "").slice(0, 120).replace(/\n/g, " ");
      samples.onlyB.push(snippet);
    }

    for (const child of node.children) walk(child);
  }

  walk(diff);
  return { ...counts, samples };
}
