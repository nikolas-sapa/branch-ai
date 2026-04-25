import Link from "next/link";
import { GALLERY } from "@/lib/gallery";

export default function GalleryPage() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Gallery</h1>
        <p className="text-neutral-600">
          Curated reasoning sessions to explore. Click any to see the full tree, fork from any node, or add a new fact.
        </p>
      </header>
      <div className="grid gap-4">
        {GALLERY.map((g) => (
          <Link
            key={g.sessionId}
            href={`/t/${g.sessionId}`}
            className="block p-5 rounded-lg border border-neutral-200 hover:border-neutral-400 transition-colors bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{g.category}</div>
                <h2 className="font-semibold text-lg mb-1">{g.title}</h2>
                <p className="text-sm text-neutral-600">{g.description}</p>
              </div>
              {g.author && <div className="text-xs text-neutral-400 shrink-0">{g.author}</div>}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
