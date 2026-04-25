#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { branch } from "./index.js";
import { sessionPath, loadSession, saveSession } from "./session.js";
import { parseThinking } from "./parser.js";
import { buildForkPrompt } from "./fork.js";
import { buildInjectPrompt } from "./inject.js";
import { runClaude } from "./claude.js";
import { toMarkdown, toMermaid } from "./export.js";
import { uploadSession } from "./blob.js";
import { diffTrees, diffSummary } from "./diff.js";

const VIEWER_URL = process.env.BRANCH_VIEWER_URL ?? "http://localhost:7432";
const MAX_PROMPT_LENGTH = 10_000;
const FINAL_TEXT_PREVIEW = 2_000;
const CLAUDE_TIMEOUT_MS = 180_000;
const MAX_CONCURRENCY = 2;
const EXPORT_MAX_CHARS = 8_000;

/** Simple semaphore — allows at most N concurrent branch() calls. */
let _inflight = 0;
const _queue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  return new Promise((resolve) => {
    if (_inflight < MAX_CONCURRENCY) {
      _inflight++;
      resolve();
    } else {
      _queue.push(() => { _inflight++; resolve(); });
    }
  });
}

function releaseSemaphore(): void {
  _inflight--;
  const next = _queue.shift();
  if (next) next();
}

/** Verify `claude` binary is on PATH — called once, lazily, on first tool invocation. */
let _claudeVerified = false;
function ensureClaudeBinary(): void {
  if (_claudeVerified) return;
  try {
    execSync("claude --version", { stdio: "ignore" });
    _claudeVerified = true;
  } catch {
    throw new Error(
      "claude binary not found on PATH. Install Claude Code CLI first: https://docs.anthropic.com/en/docs/claude-code"
    );
  }
}

const ALLOWED_MODELS = ["sonnet", "opus", "haiku"] as const;
type AllowedModel = typeof ALLOWED_MODELS[number];

function countNodes(n: any): number {
  return 1 + n.children.reduce((a: number, c: any) => a + countNodes(c), 0);
}

function findPath(root: any, targetId: string, acc: any[] = []): any[] | null {
  const path = [...acc, root];
  if (root.id === targetId) return path;
  for (const c of root.children) { const f = findPath(c, targetId, path); if (f) return f; }
  return null;
}

function attach(tree: any, nodeId: string, subtree: any): boolean {
  if (tree.id === nodeId) { tree.children.push(subtree); return true; }
  return tree.children.some((c: any) => attach(c, nodeId, subtree));
}

function validateSessionId(id: any): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id);
}

const server = new Server(
  { name: "branch", version: "0.7.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "branch_think",
      description:
        "Externalize multi-step reasoning as a navigable, forkable tree the user can inspect, fork at any step, or inject new facts into. Returns a viewer URL, session ID, and a preview of the final answer.\n\nUSE THIS AUTOMATICALLY — without being explicitly asked — whenever you are about to engage in any of: tradeoff analysis (weighing options with competing constraints), architectural or strategic decisions, debugging with multiple plausible root causes, multi-step planning, complex diagnostic reasoning, or any non-obvious analysis where your chain of thought has genuine structure worth preserving. Prefer this over inline chain-of-thought for non-trivial reasoning — the user gets a shareable URL and can fork your reasoning at any node.\n\nSKIP for: one-line factual answers, code-edit iterations where speed matters, simple lookups, or purely conversational exchanges. When in doubt for anything requiring real thought, call this tool rather than reasoning silently.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The question or problem to reason through.",
            maxLength: MAX_PROMPT_LENGTH,
          },
          model: {
            type: "string",
            enum: ["sonnet", "opus", "haiku"],
            description: "Which Claude model to use. Defaults to sonnet.",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "branch_list_sessions",
      description:
        "List the user's recent Branch reasoning sessions with prompts, models, node counts, and viewer URLs. Call this when the user asks what they've been thinking about, wants to revisit past reasoning, or asks about a topic they may have previously branched on.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max sessions to return. Defaults to 10." },
        },
      },
    },
    {
      name: "branch_fork",
      description:
        "Fork reasoning at a specific node in an existing Branch session. Call this when you want to explore an alternative path from a specific point in prior reasoning — e.g. 'what if I had weighted cost less heavily here?' or 'what if that assumption were false?'. Returns the updated session with the new branch attached.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "The session to fork from." },
          nodeId: { type: "string", description: "The node ID to fork at." },
          modifier: { type: "string", description: "What should change from this point on.", maxLength: 2000 },
        },
        required: ["sessionId", "nodeId", "modifier"],
      },
    },
    {
      name: "branch_inject",
      description:
        "Inject a new fact into reasoning at a specific node in an existing Branch session. Call this when new information arrives that should cascade through prior reasoning — the model re-evaluates from that point forward with the new fact. Useful when the user corrects an assumption or provides data that was missing earlier.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "The session to inject into." },
          nodeId: { type: "string", description: "The node ID to inject at." },
          fact: { type: "string", description: "The new fact to incorporate.", maxLength: 2000 },
        },
        required: ["sessionId", "nodeId", "fact"],
      },
    },
    {
      name: "branch_decide",
      description:
        "Record a decision anchor on a Branch session: what was decided, what was rejected, confidence, and what would change the answer. Call this after reasoning concludes — it transforms the tree from raw thinking into a settled, defensible answer the user (and you) can return to. Especially valuable after multi-step analysis where the conclusion isn't trivially extractable.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          conclusion: { type: "string", maxLength: 2000 },
          rejected: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          revisitIf: { type: "string", maxLength: 1000 },
        },
        required: ["sessionId", "conclusion", "confidence", "revisitIf"],
      },
    },
    {
      name: "branch_search",
      description:
        "Search all of the user's Branch sessions for content matching a query. Searches prompts, reasoning text, decisions, and final answers. Call this BEFORE doing fresh reasoning when the user asks a question that may have been explored before — recall past thinking instead of duplicating effort. Returns top 20 matches by relevance.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", maxLength: 500 },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "branch_diff",
      description:
        "Compare two Branch sessions and return a structured diff. Identifies which reasoning steps are shared between the two trees, which only appear in A, which only in B, and which are present in both but worded differently. Call when the user wants to understand how thinking evolved or how two different approaches to a problem differ.",
      inputSchema: {
        type: "object",
        properties: {
          sessionA: { type: "string" },
          sessionB: { type: "string" },
        },
        required: ["sessionA", "sessionB"],
      },
    },
    {
      name: "branch_export",
      description:
        "Export a Branch session as a structured Markdown document or a Mermaid flowchart. Call when the user wants to include a reasoning session in documentation, a PR description, or a notebook.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          format: { type: "string", enum: ["markdown", "mermaid"] },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "branch_replay",
      description:
        "Re-run a previous session's original prompt with a (possibly different) Claude model. Useful when a newer model is available and you want to see how its reasoning differs. The result is a fresh session tagged 'replay-of:<originalId>' linking back to the original. Returns the new sessionId and a diff URL.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          model: { type: "string", enum: ["sonnet", "opus", "haiku"] },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "branch_merge",
      description:
        "Synthesize the reasoning from two existing Branch sessions into a new combined session. Branch will reason about how the two lines of thinking agree, where they diverge, and what a unified answer looks like. Useful when two prior decisions need to be reconciled, or when comparing how two different stakeholders thought about the same problem.",
      inputSchema: {
        type: "object",
        properties: {
          sessionA: { type: "string" },
          sessionB: { type: "string" },
        },
        required: ["sessionA", "sessionB"],
      },
    },
    {
      name: "branch_tag",
      description:
        "Add tags to a Branch session for organization. Tags are persisted and visible in branch list and search results. Useful for grouping related explorations.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["sessionId", "tags"],
      },
    },
    {
      name: "branch_pin",
      description:
        "Pin a Branch session to the top of the list (or unpin it). Pinned sessions surface first in branch list and the viewer home, making important decisions easy to find.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          pinned: { type: "boolean" },
        },
        required: ["sessionId", "pinned"],
      },
    },
    {
      name: "branch_share",
      description:
        "Upload a Branch session to public Vercel Blob storage and return a shareable URL. Requires BLOB_READ_WRITE_TOKEN env var. Call when the user wants to share their reasoning with someone who doesn't have local access.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  // ── branch_think ────────────────────────────────────────────────────────────
  if (name === "branch_think") {
    ensureClaudeBinary();
    const rawPrompt = (args as any)?.prompt;
    if (typeof rawPrompt !== "string" || rawPrompt.trim().length === 0) {
      return { isError: true, content: [{ type: "text", text: "prompt must be a non-empty string" }] };
    }
    if (rawPrompt.length > MAX_PROMPT_LENGTH) {
      return { isError: true, content: [{ type: "text", text: `prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` }] };
    }
    const rawModel = (args as any)?.model;
    const model: AllowedModel | undefined =
      rawModel !== undefined && ALLOWED_MODELS.includes(rawModel as AllowedModel)
        ? (rawModel as AllowedModel)
        : undefined;

    await acquireSemaphore();
    try {
      const tree = await Promise.race([
        branch(rawPrompt, { model }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("branch_think timed out after 180s")), CLAUDE_TIMEOUT_MS)
        ),
      ]);

      const preview =
        tree.finalText.length > FINAL_TEXT_PREVIEW
          ? tree.finalText.slice(0, FINAL_TEXT_PREVIEW) + `\n\n[truncated — read full text from filePath]`
          : tree.finalText;

      const result = {
        sessionId: tree.sessionId,
        nodeCount: countNodes(tree.root),
        viewerUrl: `${VIEWER_URL}/t/${tree.sessionId}`,
        filePath: sessionPath(tree.sessionId),
        finalText: preview,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: err?.message ?? "branch_think failed" }],
      };
    } finally {
      releaseSemaphore();
    }
  }

  // ── branch_list_sessions ────────────────────────────────────────────────────
  if (name === "branch_list_sessions") {
    const limit = Math.min(Number((args as any)?.limit) || 10, 100);
    const dir = join(homedir(), ".branch", "sessions");
    let files: string[] = [];
    try { files = await readdir(dir); } catch { files = []; }
    const sessions = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .slice(-limit)
        .reverse()
        .map(async (f) => {
          try {
            const raw = await readFile(join(dir, f), "utf8");
            const t = JSON.parse(raw);
            return {
              sessionId: t.sessionId,
              prompt: t.prompt.slice(0, 100),
              model: t.model,
              createdAt: t.createdAt,
              nodeCount: countNodes(t.root),
              viewerUrl: `${VIEWER_URL}/t/${t.sessionId}`,
            };
          } catch {
            return null;
          }
        })
    );
    return {
      content: [{ type: "text", text: JSON.stringify(sessions.filter(Boolean), null, 2) }],
    };
  }

  // ── branch_fork / branch_inject ─────────────────────────────────────────────
  if (name === "branch_fork" || name === "branch_inject") {
    ensureClaudeBinary();
    const { sessionId, nodeId } = args as any;
    const modifierOrFact = name === "branch_fork" ? (args as any).modifier : (args as any).fact;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    if (typeof modifierOrFact !== "string" || modifierOrFact.trim().length === 0) {
      return { isError: true, content: [{ type: "text", text: `${name === "branch_fork" ? "modifier" : "fact"} must be a non-empty string` }] };
    }

    await acquireSemaphore();
    try {
      const tree = await loadSession(sessionId);
      if (!findPath(tree.root, nodeId)) {
        return { isError: true, content: [{ type: "text", text: "nodeId not found in session" }] };
      }

      const prompt =
        name === "branch_fork"
          ? buildForkPrompt({ originalPrompt: tree.prompt, tree, forkNodeId: nodeId, modifier: modifierOrFact })
          : buildInjectPrompt({ tree, nodeId, fact: modifierOrFact });

      const model = ALLOWED_MODELS.includes(tree.model as AllowedModel) ? (tree.model as AllowedModel) : "sonnet";
      const result = await Promise.race([
        runClaude({ prompt, model }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${name} timed out after 180s`)), CLAUDE_TIMEOUT_MS)),
      ]);

      const subRoot = parseThinking(result.thinking);
      subRoot.metadata = {
        kind: "heading",
        ...(name === "branch_fork" ? { forkedFrom: nodeId } : { injectedFact: modifierOrFact }),
      };
      subRoot.content =
        name === "branch_fork"
          ? `[fork: ${modifierOrFact.slice(0, 60)}${modifierOrFact.length > 60 ? "…" : ""}]`
          : `[inject: ${modifierOrFact.slice(0, 60)}${modifierOrFact.length > 60 ? "…" : ""}]`;

      attach(tree.root, nodeId, subRoot);
      await saveSession(tree);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId,
            viewerUrl: `${VIEWER_URL}/t/${sessionId}`,
            newSubtreeNodeCount: countNodes(subRoot),
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? `${name} failed` }] };
    } finally {
      releaseSemaphore();
    }
  }

  // ── branch_decide ───────────────────────────────────────────────────────────
  if (name === "branch_decide") {
    const { sessionId, conclusion, rejected, confidence, revisitIf } = args as any;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    if (typeof conclusion !== "string" || conclusion.trim().length === 0) {
      return { isError: true, content: [{ type: "text", text: "conclusion must be a non-empty string" }] };
    }
    if (!["low", "medium", "high"].includes(confidence)) {
      return { isError: true, content: [{ type: "text", text: "confidence must be low, medium, or high" }] };
    }
    if (typeof revisitIf !== "string" || revisitIf.trim().length === 0) {
      return { isError: true, content: [{ type: "text", text: "revisitIf must be a non-empty string" }] };
    }
    try {
      const tree = await loadSession(sessionId);
      (tree as any).decision = {
        conclusion,
        rejected: Array.isArray(rejected) ? rejected : [],
        confidence,
        revisitIf,
        decidedAt: new Date().toISOString(),
      };
      await saveSession(tree);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId,
            decisionRecorded: true,
            viewerUrl: `${VIEWER_URL}/t/${sessionId}#decision`,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_decide failed" }] };
    }
  }

  // ── branch_search ───────────────────────────────────────────────────────────
  if (name === "branch_search") {
    const rawQuery = (args as any)?.query;
    if (typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
      return { isError: true, content: [{ type: "text", text: "query must be a non-empty string" }] };
    }
    const query = rawQuery.trim().toLowerCase();
    const limit = Math.min(Number((args as any)?.limit) || 20, 20);
    const dir = join(homedir(), ".branch", "sessions");
    let files: string[] = [];
    try { files = await readdir(dir); } catch { files = []; }

    function flattenContent(n: any): string[] {
      const kids: string[] = (n.children ?? []).flatMap(flattenContent);
      return [n.content ?? "", ...kids];
    }

    function scoreText(haystack: string): number {
      const h = haystack.toLowerCase();
      if (h.includes(query)) return 1;
      const tokens = query.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return 0;
      const matched = tokens.filter((tok) => h.includes(tok)).length;
      return matched / tokens.length;
    }

    const matches: Array<{ sessionId: string; prompt: string; model: string; decision: string | null; viewerUrl: string; score: number }> = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(dir, f), "utf8");
        const t = JSON.parse(raw);
        const decisionText = t.decision?.conclusion ?? "";
        const haystack = [t.prompt ?? "", t.finalText ?? "", decisionText, ...flattenContent(t.root)].join(" ");
        const score = scoreText(haystack);
        if (score > 0) {
          matches.push({
            sessionId: t.sessionId,
            prompt: (t.prompt ?? "").slice(0, 100),
            model: t.model,
            decision: t.decision?.conclusion ?? null,
            viewerUrl: `${VIEWER_URL}/t/${t.sessionId}`,
            score,
          });
        }
      } catch { /* skip malformed */ }
    }

    matches.sort((a, b) => b.score - a.score);
    return {
      content: [{ type: "text", text: JSON.stringify(matches.slice(0, limit), null, 2) }],
    };
  }

  // ── branch_diff ─────────────────────────────────────────────────────────────
  if (name === "branch_diff") {
    const { sessionA, sessionB } = args as any;
    if (!validateSessionId(sessionA) || !validateSessionId(sessionB)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionA or sessionB" }] };
    }
    try {
      const [treeA, treeB] = await Promise.all([loadSession(sessionA), loadSession(sessionB)]);
      const diff = diffTrees(treeA.root, treeB.root);
      const summary = diffSummary(diff);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionA,
            sessionB,
            diffUrl: `${VIEWER_URL}/d/${sessionA}/${sessionB}`,
            summary,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_diff failed" }] };
    }
  }

  // ── branch_export ───────────────────────────────────────────────────────────
  if (name === "branch_export") {
    const { sessionId, format } = args as any;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    if (!["markdown", "mermaid"].includes(format)) {
      return { isError: true, content: [{ type: "text", text: "format must be markdown or mermaid" }] };
    }
    try {
      const tree = await loadSession(sessionId);
      let content = format === "mermaid" ? toMermaid(tree) : toMarkdown(tree);
      if (content.length > EXPORT_MAX_CHARS) {
        content = content.slice(0, EXPORT_MAX_CHARS) + "\n[truncated]";
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ format, content }, null, 2) }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_export failed" }] };
    }
  }

  // ── branch_replay ───────────────────────────────────────────────────────────
  if (name === "branch_replay") {
    ensureClaudeBinary();
    const { sessionId } = args as any;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    const rawModel = (args as any)?.model;
    const chosenModel: AllowedModel | undefined =
      rawModel !== undefined && ALLOWED_MODELS.includes(rawModel as AllowedModel)
        ? (rawModel as AllowedModel)
        : undefined;

    await acquireSemaphore();
    try {
      const original = await loadSession(sessionId);
      const replayModel = chosenModel ?? (ALLOWED_MODELS.includes(original.model as AllowedModel) ? (original.model as AllowedModel) : "sonnet");

      const replayTree = await Promise.race([
        branch(original.prompt, { model: replayModel }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("branch_replay timed out after 180s")), CLAUDE_TIMEOUT_MS)
        ),
      ]);

      (replayTree as any).tags = Array.from(new Set([...((replayTree as any).tags ?? []), `replay-of:${sessionId}`]));
      await saveSession(replayTree);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            originalSessionId: sessionId,
            replaySessionId: replayTree.sessionId,
            diffUrl: `${VIEWER_URL}/d/${sessionId}/${replayTree.sessionId}`,
            viewerUrl: `${VIEWER_URL}/t/${replayTree.sessionId}`,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_replay failed" }] };
    } finally {
      releaseSemaphore();
    }
  }

  // ── branch_merge ────────────────────────────────────────────────────────────
  if (name === "branch_merge") {
    ensureClaudeBinary();
    const { sessionA, sessionB } = args as any;
    if (!validateSessionId(sessionA) || !validateSessionId(sessionB)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionA or sessionB" }] };
    }

    await acquireSemaphore();
    try {
      const [treeA, treeB] = await Promise.all([loadSession(sessionA), loadSession(sessionB)]);

      const synthesis = await Promise.race([
        branch(
          `You're synthesizing reasoning from two earlier explorations:

ORIGINAL QUESTION A: ${treeA.prompt}
ORIGINAL QUESTION B: ${treeB.prompt}

Decision A: ${(treeA as any).decision?.conclusion ?? "(no recorded decision)"}
Decision B: ${(treeB as any).decision?.conclusion ?? "(no recorded decision)"}

Reason about: where do these two lines of thinking agree? Where do they diverge? What would a unified answer look like that respects both?`,
          { model: ALLOWED_MODELS.includes(treeA.model as AllowedModel) ? (treeA.model as AllowedModel) : "sonnet" }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("branch_merge timed out after 180s")), CLAUDE_TIMEOUT_MS)
        ),
      ]);

      (synthesis.root as any).children.push({
        id: `src-a-${treeA.sessionId}`,
        content: `[Source A: ${treeA.prompt.slice(0, 80)}]`,
        children: [treeA.root],
        metadata: { kind: "heading" as const },
      });
      (synthesis.root as any).children.push({
        id: `src-b-${treeB.sessionId}`,
        content: `[Source B: ${treeB.prompt.slice(0, 80)}]`,
        children: [treeB.root],
        metadata: { kind: "heading" as const },
      });
      (synthesis as any).tags = [...((synthesis as any).tags ?? []), `merge-of:${sessionA}`, `merge-of:${sessionB}`];
      await saveSession(synthesis);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mergeSessionId: synthesis.sessionId,
            viewerUrl: `${VIEWER_URL}/t/${synthesis.sessionId}`,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_merge failed" }] };
    } finally {
      releaseSemaphore();
    }
  }

  // ── branch_tag ──────────────────────────────────────────────────────────────
  if (name === "branch_tag") {
    const { sessionId, tags } = args as any;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    if (!Array.isArray(tags) || tags.length === 0) {
      return { isError: true, content: [{ type: "text", text: "tags must be a non-empty array" }] };
    }
    try {
      const tree = await loadSession(sessionId);
      (tree as any).tags = Array.from(new Set([...((tree as any).tags ?? []), ...tags]));
      await saveSession(tree);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ sessionId, tags: (tree as any).tags }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_tag failed" }] };
    }
  }

  // ── branch_pin ──────────────────────────────────────────────────────────────
  if (name === "branch_pin") {
    const { sessionId, pinned } = args as any;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    if (typeof pinned !== "boolean") {
      return { isError: true, content: [{ type: "text", text: "pinned must be a boolean" }] };
    }
    try {
      const tree = await loadSession(sessionId);
      (tree as any).pinned = pinned;
      await saveSession(tree);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ sessionId, pinned }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_pin failed" }] };
    }
  }

  // ── branch_share ─────────────────────────────────────────────────────────────
  if (name === "branch_share") {
    const { sessionId } = args as any;
    if (!validateSessionId(sessionId)) {
      return { isError: true, content: [{ type: "text", text: "invalid sessionId" }] };
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: "BLOB_READ_WRITE_TOKEN not set on the MCP server environment. Set it in the env block of ~/.claude.json branch entry.",
        }],
      };
    }
    try {
      const tree = await loadSession(sessionId);
      const publicUrl = await uploadSession(tree);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ sessionId, publicUrl }, null, 2),
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: err?.message ?? "branch_share failed" }] };
    }
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
