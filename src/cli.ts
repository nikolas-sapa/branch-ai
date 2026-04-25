#!/usr/bin/env node
import { branch, branchStream, countNodes as countNodesLib } from "./index.js";
import { sessionPath, loadSession, saveSession } from "./session.js";
import { toMarkdown, toMermaid } from "./export.js";
import { uploadSession } from "./blob.js";
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

async function runShare(args: string[]) {
  const sessionId = args[0];
  if (!sessionId) {
    console.error("Usage: branch share <sessionId>");
    console.error("Set BLOB_READ_WRITE_TOKEN env var first (https://vercel.com/dashboard/stores)");
    process.exit(1);
  }
  const tree = await loadSession(sessionId);
  console.log(`Uploading session ${sessionId} ...`);
  try {
    const url = await uploadSession(tree);
    console.log(`Public URL:`);
    console.log(`  ${url}`);
    console.log(`\nIf you have a viewer running with BRANCH_BLOB_BASE configured, share:`);
    console.log(`  ${process.env.BRANCH_VIEWER_URL ?? "https://your-viewer.example.com"}/t/${sessionId}?source=blob`);
  } catch (err: any) {
    console.error(`Upload failed: ${err.message}`);
    process.exit(1);
  }
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
  // Load all sessions, separate pinned from unpinned
  const loaded: Array<{ t: any; mtime: number }> = [];
  for (const { file, mtime } of recent) {
    try {
      const raw = await readFile(file, "utf8");
      loaded.push({ t: JSON.parse(raw), mtime });
    } catch { /* skip malformed */ }
  }
  // Pinned first, then by recency
  loaded.sort((a, b) => {
    if (a.t.pinned && !b.t.pinned) return -1;
    if (!a.t.pinned && b.t.pinned) return 1;
    return b.mtime - a.mtime;
  });
  for (const { t } of loaded) {
    const nodes = countNodes(t.root);
    const when = new Date(t.createdAt).toLocaleString();
    const promptPreview = t.prompt.length > 80 ? t.prompt.slice(0, 80) + "…" : t.prompt;
    const pin = t.pinned ? " \x1b[33m★\x1b[0m" : "";
    const inc = t.incomplete ? " \x1b[33m(incomplete)\x1b[0m" : "";
    const tags = t.tags && t.tags.length > 0 ? `  \x1b[36m[${t.tags.join(", ")}]\x1b[0m` : "";
    console.log(`\n  ${t.sessionId}${pin}${inc}  ${t.model}  ${nodes} nodes  ${when}${tags}`);
    console.log(`    ${promptPreview}`);
    console.log(`    ${VIEWER_URL}/t/${t.sessionId}`);
  }
}

async function runSearch(args: string[]) {
  const query = args.join(" ").trim().toLowerCase();
  if (!query) {
    console.error("Usage: branch search <query>");
    process.exit(1);
  }
  const dir = join(homedir(), ".branch", "sessions");
  let files: string[] = [];
  try { files = await readdir(dir); } catch { files = []; }

  function flattenContent(n: any): string[] {
    const kids: string[] = (n.children ?? []).flatMap(flattenContent);
    return [n.content ?? "", ...kids];
  }

  function scoreText(haystack: string): number {
    const h = haystack.toLowerCase();
    // Exact phrase match = full score
    if (h.includes(query)) return 1;
    // Token match — fraction of query tokens present
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return 0;
    const matched = tokens.filter((tok) => h.includes(tok)).length;
    return matched / tokens.length;
  }

  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const YELLOW = "\x1b[33m";

  function highlight(text: string): string {
    // Highlight exact query occurrences
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return text.slice(0, idx) + YELLOW + BOLD + text.slice(idx, idx + query.length) + RESET + text.slice(idx + query.length);
  }

  const matches: { t: any; score: number }[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(dir, f), "utf8");
      const t = JSON.parse(raw);
      const haystack = [t.prompt ?? "", t.finalText ?? "", ...flattenContent(t.root)].join(" ");
      const s = scoreText(haystack);
      if (s > 0) matches.push({ t, score: s });
    } catch { /* skip */ }
  }

  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    console.log(`No sessions match "${query}"`);
    return;
  }

  for (const { t, score } of matches.slice(0, 20)) {
    const when = new Date(t.createdAt).toLocaleString();
    const promptDisplay = highlight(t.prompt.slice(0, 100));
    console.log(`\n  ${t.sessionId}  ${t.model}  score:${score.toFixed(2)}  ${when}`);
    console.log(`    ${promptDisplay}`);
    console.log(`    ${VIEWER_URL}/t/${t.sessionId}`);
  }
}

async function runTag(args: string[]) {
  const sessionId = args[0];
  const tags = args.slice(1);
  if (!sessionId || tags.length === 0) {
    console.error("Usage: branch tag <sessionId> <tag1> [tag2 ...]");
    process.exit(1);
  }
  const tree = await loadSession(sessionId);
  (tree as any).tags = Array.from(new Set([...((tree as any).tags ?? []), ...tags]));
  await saveSession(tree);
  console.log(`Tagged ${sessionId}: ${(tree as any).tags.join(", ")}`);
}

async function runPin(args: string[], pinned: boolean) {
  const sessionId = args[0];
  if (!sessionId) {
    console.error(`Usage: branch ${pinned ? "pin" : "unpin"} <sessionId>`);
    process.exit(1);
  }
  const tree = await loadSession(sessionId);
  (tree as any).pinned = pinned;
  await saveSession(tree);
  console.log(`${pinned ? "Pinned" : "Unpinned"}: ${sessionId}`);
}

async function runDefault(args: string[]) {
  const skipOpen = args.includes("--no-open");
  const noStream = args.includes("--no-stream");
  let model: "sonnet" | "opus" | "haiku" = "sonnet";
  const prompt: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--model") { model = args[++i] as any; continue; }
    if (a === "--no-open") continue;
    if (a === "--no-stream") continue;
    prompt.push(a);
  }
  if (prompt.length === 0) {
    console.error(`Usage:
  branch [--model sonnet|opus|haiku] [--no-open] [--no-stream] "your prompt"
  branch list [--limit N]
  branch export <sessionId> [--format markdown|mermaid]
  branch diff <sessionA> <sessionB>
  branch share <sessionId>`);
    process.exit(1);
  }
  const joined = prompt.join(" ");

  if (!noStream) {
    console.log(`Thinking with ${model} (streaming)...`);
    let nodeCount = 0;
    let finalTree: any = null;
    for await (const ev of branchStream(joined, { model })) {
      if (ev.type === "start") {
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

  // --no-stream legacy path
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

async function runDiff(args: string[]) {
  const [a, b] = args;
  if (!a || !b) {
    console.error("Usage: branch diff <sessionA> <sessionB>");
    process.exit(1);
  }
  const url = `${VIEWER_URL}/d/${a}/${b}`;
  console.log(`Diff: ${url}`);
  if (await viewerReachable(VIEWER_URL)) openInBrowser(url);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "export") return runExport(args.slice(1));
  if (args[0] === "list") return runList(args.slice(1));
  if (args[0] === "diff") return runDiff(args.slice(1));
  if (args[0] === "share") return runShare(args.slice(1));
  if (args[0] === "search") return runSearch(args.slice(1));
  if (args[0] === "tag") return runTag(args.slice(1));
  if (args[0] === "pin") return runPin(args.slice(1), true);
  if (args[0] === "unpin") return runPin(args.slice(1), false);
  return runDefault(args);
}

main().catch((e) => { console.error(e); process.exit(1); });
