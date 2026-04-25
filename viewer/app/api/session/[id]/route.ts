import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { NextResponse } from "next/server";

const BLOB_BASE = process.env.BRANCH_BLOB_BASE ?? "";
const BLOB_PREFIX = "branch-sessions";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  // Try local first
  try {
    const path = join(homedir(), ".branch", "sessions", `${id}.json`);
    const raw = await readFile(path, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {}
  // Fallback to blob
  if (BLOB_BASE) {
    try {
      const url = `${BLOB_BASE.replace(/\/$/, "")}/${BLOB_PREFIX}/${id}.json`;
      const res = await fetch(url);
      if (res.ok) return NextResponse.json(await res.json());
    } catch {}
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
