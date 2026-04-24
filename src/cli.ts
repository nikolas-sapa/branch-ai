#!/usr/bin/env node
import { branch } from "./index.js";
import { sessionPath } from "./session.js";

const VIEWER_URL = process.env.BRANCH_VIEWER_URL ?? "http://localhost:3000";

async function main() {
  const args = process.argv.slice(2);
  let model: "sonnet" | "opus" | "haiku" = "sonnet";
  const prompt: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model") {
      model = args[++i] as any;
    } else {
      prompt.push(args[i]);
    }
  }
  if (prompt.length === 0) {
    console.error("Usage: branch [--model sonnet|opus|haiku] \"your prompt\"");
    process.exit(1);
  }
  const joined = prompt.join(" ");
  console.log(`Thinking with ${model}...`);
  const tree = await branch(joined, { model });
  const url = `${VIEWER_URL}/t/${tree.sessionId}`;
  console.log(`\nDone.`);
  console.log(`  Session: ${tree.sessionId}`);
  console.log(`  Nodes:   ${countNodes(tree.root)}`);
  console.log(`  File:    ${sessionPath(tree.sessionId)}`);
  console.log(`  View:    ${url}`);
}

function countNodes(n: any): number {
  return 1 + n.children.reduce((a: number, c: any) => a + countNodes(c), 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
