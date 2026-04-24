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
import { branch } from "./index.js";
import { sessionPath } from "./session.js";

const VIEWER_URL = process.env.BRANCH_VIEWER_URL ?? "http://localhost:3000";

function countNodes(n: any): number {
  return 1 + n.children.reduce((a: number, c: any) => a + countNodes(c), 0);
}

const server = new Server(
  { name: "branch", version: "0.0.1" },
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
          prompt: { type: "string", description: "The question or problem to reason through." },
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
    const { prompt, model } = args as { prompt: string; model?: "sonnet" | "opus" | "haiku" };
    const tree = await branch(prompt, { model });
    const result = {
      sessionId: tree.sessionId,
      nodeCount: countNodes(tree.root),
      viewerUrl: `${VIEWER_URL}/t/${tree.sessionId}`,
      filePath: sessionPath(tree.sessionId),
      finalText: tree.finalText,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (name === "branch_list_sessions") {
    const limit = (args as any)?.limit ?? 10;
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

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
