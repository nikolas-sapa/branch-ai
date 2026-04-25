import { TreeCanvas } from "@/components/TreeCanvas";
import { FinalTextPanel } from "@/components/FinalTextPanel";
import { SessionHeaderActions } from "@/components/SessionHeaderActions";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

async function loadTree(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("invalid id");
  try {
    const path = join(homedir(), ".branch", "sessions", `${id}.json`);
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {}
  const blobBase = process.env.BRANCH_BLOB_BASE;
  if (blobBase) {
    const url = `${blobBase.replace(/\/$/, "")}/branch-sessions/${id}.json`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  }
  throw new Error(`session ${id} not found locally or in blob storage`);
}

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await loadTree(id);
  return (
    <main className="flex flex-col h-screen overflow-hidden">
      <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-6 shrink-0 gap-3">
        <div className="font-semibold tracking-tight shrink-0">Branch</div>
        <div className="text-sm text-neutral-500 truncate min-w-0">{tree.prompt}</div>

        {/* Tags */}
        {tree.tags && tree.tags.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {(tree.tags as string[]).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs border border-neutral-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Incomplete badge */}
        {tree.incomplete && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs border border-yellow-200 font-medium">
            incomplete
          </span>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-400">{tree.model}</span>
          {/* Pin + Tag actions (client component) */}
          <SessionHeaderActions
            sessionId={id}
            initialPinned={tree.pinned ?? false}
            initialTags={tree.tags ?? []}
          />
          {tree.finalText && <FinalTextPanel finalText={tree.finalText} />}
        </div>
      </header>
      <div className="flex-1 min-h-0 relative">
        <TreeCanvas root={tree.root} sessionId={id} />
      </div>
    </main>
  );
}
