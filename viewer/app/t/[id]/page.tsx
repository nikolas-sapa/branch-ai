import { TreeCanvas } from "@/components/TreeCanvas";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

async function loadTree(id: string) {
  const path = join(homedir(), ".branch", "sessions", `${id}.json`);
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await loadTree(id);
  return (
    <main>
      <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-6">
        <div className="font-semibold tracking-tight">Branch</div>
        <div className="ml-6 text-sm text-neutral-500 truncate">{tree.prompt}</div>
        <div className="ml-auto text-xs text-neutral-400">{tree.model}</div>
      </header>
      <TreeCanvas root={tree.root} sessionId={id} />
    </main>
  );
}
