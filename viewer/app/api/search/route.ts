import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { NextRequest, NextResponse } from "next/server";

function flattenContent(n: any): string[] {
  const kids: string[] = (n.children ?? []).flatMap(flattenContent);
  return [n.content ?? "", ...kids];
}

function scoreText(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  if (h.includes(query)) return 1;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((tok) => h.includes(tok)).length;
  return matched / tokens.length;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const dir = join(homedir(), ".branch", "sessions");
  let files: string[] = [];
  try { files = await readdir(dir); } catch { files = []; }

  const matches: { sessionId: string; prompt: string; model: string; createdAt: string; score: number }[] = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(dir, f), "utf8");
      const t = JSON.parse(raw);
      const haystack = [t.prompt ?? "", t.finalText ?? "", ...flattenContent(t.root)].join(" ");
      const s = scoreText(haystack, q);
      if (s > 0) {
        matches.push({
          sessionId: t.sessionId,
          prompt: t.prompt ?? "",
          model: t.model ?? "",
          createdAt: t.createdAt ?? "",
          score: s,
        });
      }
    } catch { /* skip */ }
  }

  matches.sort((a, b) => b.score - a.score);
  return NextResponse.json({ results: matches.slice(0, 20) });
}
