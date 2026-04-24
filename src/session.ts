import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { TreeSchema, type Tree } from "./tree.js";

const ROOT = join(homedir(), ".branch", "sessions");

export function sessionPath(id: string): string {
  return join(ROOT, `${id}.json`);
}

export async function saveSession(tree: Tree): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  await writeFile(sessionPath(tree.sessionId), JSON.stringify(tree, null, 2), "utf8");
}

export async function loadSession(id: string): Promise<Tree> {
  const raw = await readFile(sessionPath(id), "utf8");
  return TreeSchema.parse(JSON.parse(raw));
}
