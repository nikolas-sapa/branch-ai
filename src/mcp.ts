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

const VIEWER_URL = process.env.BRANCH_VIEWER_URL ?? "http://localhost:7432";
const MAX_PROMPT_LENGTH = 10_000;
const FINAL_TEXT_PREVIEW = 2_000;
const CLAUDE_TIMEOUT_MS = 180_000;
const MAX_CONCURRENCY = 2;

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

const server = new Server(
  { name: "branch", version: "0.2.1" },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "branch_think") {
    // Input validation
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

  if (name === "branch_fork" || name === "branch_inject") {
    ensureClaudeBinary();
    const { sessionId, nodeId } = args as any;
    const modifierOrFact = name === "branch_fork" ? (args as any).modifier : (args as any).fact;
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId || "")) {
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

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
