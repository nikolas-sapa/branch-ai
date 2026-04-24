import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseThinking } from "../../../lib/parser";

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_MODELS = ["sonnet", "opus", "haiku"] as const;

export async function POST(req: Request) {
  const { sessionId, nodeId, fact } = await req.json();
  if (!sessionId || !nodeId || !fact) {
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
  const prior = pathNodes.slice(1).map((n: any) => n.content).join("\n\n");
  const prompt = `Original question: ${tree.prompt}\n\nPrior reasoning:\n${prior}\n\nNEW FACT: ${fact}\n\nRe-examine reasoning in light of this fact.`;

  const safeModel = ALLOWED_MODELS.includes(tree.model) ? tree.model : "sonnet";
  const child = spawn("claude", ["--output-format=stream-json", "--verbose", "--print", prompt, "--model", safeModel]);
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

  const injected = parseThinking(thinking);
  injected.metadata = { kind: "heading", injectedFact: fact };
  injected.content = `[inject: ${fact.slice(0, 60)}${fact.length > 60 ? "…" : ""}]`;

  const attach = (n: any): boolean => {
    if (n.id === nodeId) { n.children.push(injected); return true; }
    return n.children.some(attach);
  };
  attach(tree.root);
  await writeFile(path, JSON.stringify(tree, null, 2), "utf8");
  return NextResponse.json({ ok: true });
}
