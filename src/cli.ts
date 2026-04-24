#!/usr/bin/env node
import { branch, branchStream, countNodes as countNodesLib } from "./index.js";
import { sessionPath, loadSession } from "./session.js";
import { toMarkdown, toMermaid } from "./export.js";
import { spawn } from "node:child_process";
import { platform, homedir } from "node:os";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIEWER_URL = process.env.BRANCH_VIEWER_URL ?? "http://localhost:7432";

async function viewerReachable(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 250);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function openInBrowser(url: string): void {
  const cmd =
    platform() === "darwin" ? "open" :
    platform() === "win32" ? "cmd.exe" :
    "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch { /* silent fail — user already has the URL printed */ }
}

async function findViewerDir(): Promise<string | null> {
  if (process.env.BRANCH_VIEWER_DIR && existsSync(process.env.BRANCH_VIEWER_DIR)) {
    return process.env.BRANCH_VIEWER_DIR;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", "..", "viewer"),
    resolve(here, "..", "viewer"),
    join(homedir(), "Developer", "branch", "viewer"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "package.json"))) return c;
  }
  return null;
}

async function startViewer(viewerDir: string, url: string): Promise<boolean> {
  console.log(`Starting viewer in ${viewerDir} ...`);
  const child = spawn("npm", ["run", "dev"], {
    cwd: viewerDir,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  // Poll for reachability up to 15s
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await viewerReachable(url)) return true;
  }
  return false;
}

function countNodes(n: any): number {
  return countNodesLib(n);
}

async function runExport(args: string[]) {
  const sessionId = args[0];
  if (!sessionId) {
    console.error("Usage: branch export <sessionId> [--format markdown|mermaid]");
    process.exit(1);
  }
  const formatIdx = args.indexOf("--format");
  const format = formatIdx !== -1 ? args[formatIdx + 1] : "markdown";
  const tree = await loadSession(sessionId);
  if (format === "mermaid") console.log(toMermaid(tree));
  else console.log(toMarkdown(tree));
}

async function runList(args: string[]) {
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 10 : 10;
  const dir = join(homedir(), ".branch", "sessions");
  let files: string[] = [];
  try { files = await readdir(dir); } catch { files = []; }
  const entries = await Promise.all(
    files.filter((f) => f.endsWith(".json")).map(async (f) => {
      const full = join(dir, f);
      const s = await stat(full);
      return { file: full, mtime: s.mtimeMs };
    })
  );
  entries.sort((a, b) => b.mtime - a.mtime);
  const recent = entries.slice(0, limit);
  if (recent.length === 0) {
    console.log('No Branch sessions yet. Run: branch "your prompt"');
    return;
  }
  for (const { file } of recent) {
    try {
      const raw = await readFile(file, "utf8");
      const t = JSON.parse(raw);
      const nodes = countNodes(t.root);
      const when = new Date(t.createdAt).toLocaleString();
      const promptPreview = t.prompt.length > 80 ? t.prompt.slice(0, 80) + "…" : t.prompt;
      console.log(`\n  ${t.sessionId}  ${t.model}  ${nodes} nodes  ${when}`);
      console.log(`    ${promptPreview}`);
      console.log(`    ${VIEWER_URL}/t/${t.sessionId}`);
    } catch { /* skip malformed */ }
  }
}

async function runDefault(args: string[]) {
  const skipOpen = args.includes("--no-open");
  const useStream = args.includes("--stream");
  let model: "sonnet" | "opus" | "haiku" = "sonnet";
  const prompt: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--model") { model = args[++i] as any; continue; }
    if (a === "--no-open") continue;
    if (a === "--stream") continue;
    prompt.push(a);
  }
  if (prompt.length === 0) {
    console.error(`Usage:
  branch [--model sonnet|opus|haiku] [--no-open] [--stream] "your prompt"
  branch list [--limit N]
  branch export <sessionId> [--format markdown|mermaid]`);
    process.exit(1);
  }
  const joined = prompt.join(" ");

  if (useStream) {
    console.log(`Thinking with ${model} (streaming)...`);
    let nodeCount = 0;
    let sessionId = "";
    let finalTree: any = null;
    for await (const ev of branchStream(joined, { model })) {
      if (ev.type === "start") {
        sessionId = ev.sessionId;
        console.log(`  Session: ${ev.sessionId}`);
      }
      if (ev.type === "tree_update") {
        const n = countNodes(ev.root);
        if (n !== nodeCount) {
          nodeCount = n;
          process.stdout.write(`\r  Nodes: ${n}   `);
        }
      }
      if (ev.type === "done") {
        finalTree = ev.tree;
      }
    }
    process.stdout.write("\n");
    if (finalTree) {
      const url = `${VIEWER_URL}/t/${finalTree.sessionId}`;
      console.log(`\nDone.`);
      console.log(`  Session: ${finalTree.sessionId}`);
      console.log(`  Nodes:   ${countNodes(finalTree.root)}`);
      console.log(`  File:    ${sessionPath(finalTree.sessionId)}`);
      console.log(`  View:    ${url}`);
      let reachable = await viewerReachable(VIEWER_URL);
      if (!reachable) {
        const viewerDir = await findViewerDir();
        if (viewerDir) reachable = await startViewer(viewerDir, VIEWER_URL);
      }
      if (!reachable) {
        console.log(`\n(Viewer isn't running and couldn't auto-start. Start manually: cd viewer && npm run dev)`);
      } else if (!skipOpen) {
        openInBrowser(url);
      }
    }
    return;
  }

  console.log(`Thinking with ${model}...`);
  const tree = await branch(joined, { model });
  const url = `${VIEWER_URL}/t/${tree.sessionId}`;
  console.log(`\nDone.`);
  console.log(`  Session: ${tree.sessionId}`);
  console.log(`  Nodes:   ${countNodes(tree.root)}`);
  console.log(`  File:    ${sessionPath(tree.sessionId)}`);
  console.log(`  View:    ${url}`);

  let reachable = await viewerReachable(VIEWER_URL);
  if (!reachable) {
    const viewerDir = await findViewerDir();
    if (viewerDir) reachable = await startViewer(viewerDir, VIEWER_URL);
  }
  if (!reachable) {
    console.log(`\n(Viewer isn't running and couldn't auto-start. Start manually: git clone https://github.com/84yk8btb9f-prog/branch-ai && cd branch-ai && npm run viewer)`);
  } else if (!skipOpen) {
    openInBrowser(url);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "export") return runExport(args.slice(1));
  if (args[0] === "list") return runList(args.slice(1));
  return runDefault(args);
}

main().catch((e) => { console.error(e); process.exit(1); });
