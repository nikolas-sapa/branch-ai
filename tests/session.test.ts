import { describe, it, expect, afterEach } from "vitest";
import { saveSession, loadSession, sessionPath } from "../src/session.js";
import { existsSync, rmSync } from "node:fs";
import type { Tree } from "../src/tree.js";

const fixture: Tree = {
  sessionId: "test-abc",
  prompt: "test prompt",
  model: "sonnet",
  createdAt: new Date().toISOString(),
  root: { id: "r1", content: "Root", children: [], metadata: { kind: "root" } },
  finalText: "done",
};

afterEach(() => {
  const p = sessionPath("test-abc");
  if (existsSync(p)) rmSync(p);
});

describe("session storage", () => {
  it("saves and loads a tree", async () => {
    await saveSession(fixture);
    const loaded = await loadSession("test-abc");
    expect(loaded).toEqual(fixture);
  });
});
