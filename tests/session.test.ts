import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { saveSession, loadSession, sessionPath } from "../src/session.js";
import { existsSync, rmSync } from "node:fs";
import type { Tree } from "../src/tree.js";

const storage = vi.hoisted(() => ({
  root: `${process.cwd()}/../branch-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
}));
vi.mock("node:os", async (original) => ({ ...await original<typeof import("node:os")>(),
  homedir: () => storage.root }));
afterAll(() => rmSync(storage.root, { recursive: true, force: true }));

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
  it.each(["", "..", "../outside", "a/b", "a\\b", "/absolute"])(
    "rejects unsafe ID %j before filesystem access", async (id) => {
      expect(() => sessionPath(id)).toThrow(/invalid session id/i);
      await expect(loadSession(id)).rejects.toThrow(/invalid session id/i);
      await expect(saveSession({ ...fixture, sessionId: id })).rejects.toThrow(/invalid session id/i);
    }
  );
  it("saves and loads a tree", async () => {
    await saveSession(fixture);
    const loaded = await loadSession("test-abc");
    expect(loaded).toEqual(fixture);
  });
});
