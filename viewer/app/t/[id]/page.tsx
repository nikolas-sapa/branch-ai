import { TreeCanvas } from "@/components/TreeCanvas";
import { FinalTextPanel } from "@/components/FinalTextPanel";
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
      <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-6 shrink-0">
        <div className="font-semibold tracking-tight">Branch</div>
        <div className="ml-6 text-sm text-neutral-500 truncate">{tree.prompt}</div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-neutral-400">{tree.model}</span>
          {tree.finalText && <FinalTextPanel finalText={tree.finalText} />}
        </div>
      </header>
      <div className="flex-1 min-h-0 relative">
        <TreeCanvas root={tree.root} sessionId={id} />
      </div>
    </main>
  );
}
