import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ headers: new Headers({ host: "public.example" }),
  read: vi.fn(), write: vi.fn(), list: vi.fn(), spawn: vi.fn() }));
vi.mock("../viewer/node_modules/next/headers.js", () => ({ headers: async () => state.headers }));
vi.mock("node:os", () => ({ homedir: () => "/fixture-private" }));
vi.mock("node:fs/promises", () => ({ readFile: state.read, writeFile: state.write, readdir: state.list }));
vi.mock("node:child_process", () => ({ spawn: state.spawn }));
import { POST as stream } from "../viewer/app/api/stream/route.js";
import { POST as fork } from "../viewer/app/api/fork/route.js";
import { POST as inject } from "../viewer/app/api/inject/route.js";
import { isLocalRequest, isLocalMutation } from "../viewer/lib/server-mode.js";
import { GET as session } from "../viewer/app/api/session/[id]/route.js";
import { GET as search } from "../viewer/app/api/search/route.js";
import { PATCH, DELETE } from "../viewer/app/api/tag/route.js";
vi.mock("@/components/TreeCanvas", () => ({ TreeCanvas: () => null }));
vi.mock("@/components/FinalTextPanel", () => ({ FinalTextPanel: () => null }));
vi.mock("@/components/SessionHeaderActions", () => ({ SessionHeaderActions: () => null }));
vi.mock("@/components/DecisionPanel", () => ({ DecisionPanel: () => null }));
vi.mock("@/components/DiffCanvas", () => ({ DiffCanvas: () => null }));
import TreePage from "../viewer/app/t/[id]/page.js";
import DiffPage from "../viewer/app/d/[a]/[b]/page.js";
import { NextRequest } from "../viewer/node_modules/next/server.js";

const priorOverride = process.env.BRANCH_ALLOW_HOSTED_EDITS;
afterEach(() => {
  vi.clearAllMocks();
  if (priorOverride === undefined) delete process.env.BRANCH_ALLOW_HOSTED_EDITS;
  else process.env.BRANCH_ALLOW_HOSTED_EDITS = priorOverride;
});

describe("viewer private boundaries", () => {
  it.each(["localhost.attacker.invalid", "127.0.0.1.attacker.invalid", "192.168.1.2", "0.0.0.0", "evil@localhost"])(
    "denies non-loopback host %s", async (host) => {
      state.headers = new Headers({ host });
      delete process.env.BRANCH_ALLOW_HOSTED_EDITS;
      expect(await isLocalRequest()).toBe(false);
    }
  );
  it.each(["localhost:7432", "127.0.0.1:7432", "[::1]:7432"])(
    "accepts exact loopback host %s", async (host) => {
      state.headers = new Headers({ host });
      expect(await isLocalRequest()).toBe(true);
    }
  );
  it("does not expose private sessions on hosted requests, even with edit override", async () => {
    state.headers = new Headers({ host: "public.example" });
    process.env.BRANCH_ALLOW_HOSTED_EDITS = "1";
    state.read.mockImplementation(async (path: string) => JSON.stringify({
      sessionId: "gallery", prompt: path.includes("/fixture-private/") ? "private" : "public" }));
    const response = await session(new Request("https://public.example/api/session/gallery"),
      { params: Promise.resolve({ id: "gallery" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).prompt).toBe("public");
    expect(state.read.mock.calls.every(([path]) => !String(path).includes("/fixture-private/"))).toBe(true);
  });
  it("does not enumerate hosted private sessions", async () => {
    state.headers = new Headers({ host: "public.example" });
    state.list.mockResolvedValue([]);
    const response = await search(new NextRequest("https://public.example/api/search?q=secret"));
    expect(response.status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();
  });
  it.each([PATCH, DELETE])("denies hosted tag mutations before storage access", async (route) => {
    state.headers = new Headers({ host: "public.example" });
    delete process.env.BRANCH_ALLOW_HOSTED_EDITS;
    const response = await route(new NextRequest("https://public.example/api/tag", {
      method: "PATCH", body: JSON.stringify({ sessionId: "fixture", tags: ["tag"] }),
      headers: { "content-type": "application/json" } }));
    expect(response.status).toBe(403);
    expect(state.read).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
  it.each([PATCH, DELETE])("denies cross-origin local tag mutations before storage access", async (route) => {
    state.headers = new Headers({ host: "localhost:7432", origin: "https://attacker.invalid",
      "sec-fetch-site": "cross-site" });
    const response = await route(new NextRequest("http://localhost:7432/api/tag", {
      method: "PATCH", body: JSON.stringify({ sessionId: "fixture", tags: ["tag"] }),
      headers: { "content-type": "text/plain", origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" } }));
    expect(response.status).toBe(403);
    expect(state.read).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
  it.each([stream, fork, inject])("denies hostile origin before spawning providers", async (route) => {
    state.headers = new Headers({ host: "localhost:7432" });
    const response = await route(new Request("http://localhost:7432/api/provider", {
      method: "POST", body: "{}", headers: { origin: "https://attacker.invalid" },
    }));
    expect(response.status).toBe(403);
    expect(state.spawn).not.toHaveBeenCalled();
    expect(state.read).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
  it.each(["http://localhost:7432", undefined])("allows same-origin browser or local CLI mutation %s", async (origin) => {
    state.headers = new Headers({ host: "localhost:7432" });
    expect(await isLocalMutation(new Request("http://localhost:7432/api/tag", {
      method: "PATCH", headers: origin ? { origin } : {},
    }))).toBe(true);
  });
  it("hosted edit override still rejects cross-origin mutations", async () => {
    state.headers = new Headers({ host: "public.example" });
    process.env.BRANCH_ALLOW_HOSTED_EDITS = "1";
    expect(await isLocalMutation(new Request("https://public.example/api/tag", {
      method: "PATCH", headers: { origin: "https://attacker.invalid" },
    }))).toBe(false);
  });

  it("hosted tree page never reads private storage", async () => {
    state.headers = new Headers({ host: "public.example" });
    process.env.BRANCH_ALLOW_HOSTED_EDITS = "1";
    state.read.mockRejectedValue(new Error("gallery fixture absent"));
    await expect(TreePage({ params: Promise.resolve({ id: "fixture" }) })).rejects.toThrow("not found");
    expect(state.read.mock.calls.every(([path]) => !String(path).includes("/fixture-private/"))).toBe(true);
  });
  it("hosted diff page never reads private storage", async () => {
    state.headers = new Headers({ host: "public.example" });
    process.env.BRANCH_ALLOW_HOSTED_EDITS = "1";
    await expect(DiffPage({ params: Promise.resolve({ a: "fixture", b: "other" }) })).rejects.toThrow("not found");
    expect(state.read).not.toHaveBeenCalled();
  });

  it.each([fork, inject])("rejects missing nodes before spawning providers", async (route) => {
    state.headers = new Headers({ host: "localhost:7432" });
    state.read.mockResolvedValue(JSON.stringify({ prompt: "fixture", model: "sonnet", root: { id: "root", children: [] } }));
    const response = await route(new Request("http://localhost:7432/api/provider", {
      method: "POST", body: JSON.stringify({ sessionId: "fixture", nodeId: "missing", modifier: "change", fact: "fact" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(404);
    expect(state.spawn).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });

});
