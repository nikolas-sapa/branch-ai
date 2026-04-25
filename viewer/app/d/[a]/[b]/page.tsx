import { DiffCanvas } from "@/components/DiffCanvas";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

async function loadTree(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("invalid id");
  const raw = await readFile(
    join(homedir(), ".branch", "sessions", `${id}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

export default async function DiffPage({
  params,
}: {
  params: Promise<{ a: string; b: string }>;
}) {
  const { a, b } = await params;
  const [treeA, treeB] = await Promise.all([loadTree(a), loadTree(b)]);

  return (
    <main>
      <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-6 gap-4">
        <div className="font-semibold tracking-tight text-neutral-900">
          Branch Diff
        </div>
        <div className="flex-1 flex items-center gap-4 text-xs text-neutral-500 truncate min-w-0">
          <div className="truncate">
            <span className="text-green-600 font-medium">A</span>{" "}
            {treeA.prompt.slice(0, 60)}
            {treeA.prompt.length > 60 ? "…" : ""}
          </div>
          <div className="shrink-0 text-neutral-300">vs</div>
          <div className="truncate">
            <span className="text-blue-600 font-medium">B</span>{" "}
            {treeB.prompt.slice(0, 60)}
            {treeB.prompt.length > 60 ? "…" : ""}
          </div>
        </div>
        <div className="flex gap-4 text-xs shrink-0">
          <LegendDot color="bg-neutral-300" label="shared" />
          <LegendDot color="bg-yellow-300" label="changed" />
          <LegendDot color="bg-green-300" label="only A" />
          <LegendDot color="bg-blue-300" label="only B" />
        </div>
      </header>
      <DiffCanvas treeA={treeA} treeB={treeB} />
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-neutral-600">{label}</span>
    </div>
  );
}
