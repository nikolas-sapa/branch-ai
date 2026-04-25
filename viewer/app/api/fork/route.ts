import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { isLocalRequest } from "@/lib/server-mode";

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_MODELS = ["sonnet", "opus", "haiku"] as const;

export async function POST(req: Request) {
  if (!(await isLocalRequest())) {
    return NextResponse.json(
      { error: "Fork and inject require a local Branch installation. Install with: npm install -g branch-ai" },
      { status: 403 }
    );
  }
  const { sessionId, nodeId, modifier } = await req.json();
  if (!sessionId || !nodeId || !modifier) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }
  if (!SESSION_ID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
  }
  const path = join(homedir(), ".branch", "sessions", `${sessionId}.json`);
  const tree = JSON.parse(await readFile(path, "utf8"));

  const findPath = (n: any, tid: string, acc: any[] = []): any[] | null => {
    const p = [...acc, n];
    if (n.id === tid) return p;
    for (const c of n.children) { const f = findPath(c, tid, p); if (f) return f; }
    return null;
  };
  const pathNodes = findPath(tree.root, nodeId) ?? [];
  const priorReasoning = pathNodes.slice(1).map((n: any) => n.content).join("\n\n");
  const forkPrompt = `Original question: ${tree.prompt}\n\nYou previously reasoned:\n${priorReasoning}\n\nNow reconsider with this change: ${modifier}\n\nThink carefully.`;

  const safeModel = ALLOWED_MODELS.includes(tree.model) ? tree.model : "sonnet";
  const child = spawn("claude", ["--output-format=stream-json", "--verbose", "--print", forkPrompt, "--model", safeModel]);
  let stdout = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  await new Promise((resolve) => child.on("close", resolve));

  let thinking = "";
  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.type === "assistant" && ev.message?.content) {
        for (const b of ev.message.content) {
          if (b.type === "thinking") thinking += b.thinking ?? "";
        }
      }
    } catch {}
  }

  const { parseThinking } = await import("../../../lib/parser");
  const forkedRoot = parseThinking(thinking);
  forkedRoot.metadata = { kind: "heading", forkedFrom: nodeId };
  forkedRoot.content = `[fork: ${modifier}]`;

  const attach = (n: any): boolean => {
    if (n.id === nodeId) { n.children.push(forkedRoot); return true; }
    return n.children.some(attach);
  };
  attach(tree.root);
  await writeFile(path, JSON.stringify(tree, null, 2), "utf8");

  return NextResponse.json({ ok: true, tree, newNodeId: forkedRoot.id });
}
