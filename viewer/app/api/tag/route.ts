import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { isLocalMutation } from "@/lib/server-mode";

function sessionPath(id: string): string {
  return join(homedir(), ".branch", "sessions", `${id}.json`);
}

export async function PATCH(req: NextRequest) {
  if (!(await isLocalMutation(req))) {
    return NextResponse.json({ error: "local same-origin request required" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { sessionId, tags, pinned } = body as {
      sessionId?: string;
      tags?: string[];
      pinned?: boolean;
    };
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
    }
    const path = sessionPath(sessionId);
    const raw = await readFile(path, "utf8");
    const tree = JSON.parse(raw);
    if (Array.isArray(tags)) {
      tree.tags = Array.from(new Set([...(tree.tags ?? []), ...tags]));
    }
    if (typeof pinned === "boolean") {
      tree.pinned = pinned;
    }
    await writeFile(path, JSON.stringify(tree, null, 2), "utf8");
    return NextResponse.json({ ok: true, tags: tree.tags, pinned: tree.pinned });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isLocalMutation(req))) {
    return NextResponse.json({ error: "local same-origin request required" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { sessionId, tag } = body as { sessionId?: string; tag?: string };
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
    }
    const path = sessionPath(sessionId);
    const raw = await readFile(path, "utf8");
    const tree = JSON.parse(raw);
    if (tag) {
      tree.tags = (tree.tags ?? []).filter((t: string) => t !== tag);
    }
    await writeFile(path, JSON.stringify(tree, null, 2), "utf8");
    return NextResponse.json({ ok: true, tags: tree.tags });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
