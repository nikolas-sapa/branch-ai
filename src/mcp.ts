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
import { sessionPath } from "./session.js";

const VIEWER_URL = process.env.BRANCH_VIEWER_URL ?? "http://localhost:3000";
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

const server = new Server(
  { name: "branch", version: "0.1.2" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "branch_think",
      description:
        "Ask Claude to think through a question with extended reasoning, capture the thinking as a navigable tree, and return a URL to view it. Use this when you want to externalize reasoning so it can be inspected or forked later.",
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
      description: "List recent Branch sessions with their prompts and viewer URLs.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max sessions to return. Defaults to 10." },
        },
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

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
