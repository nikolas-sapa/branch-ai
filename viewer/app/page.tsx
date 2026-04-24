export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Branch</h1>
        <p className="text-neutral-600">
          Run <code className="bg-neutral-200 rounded px-1 py-0.5 text-sm">branch &quot;your question&quot;</code> in your terminal, then open the session URL printed there.
        </p>
      </div>
    </main>
  );
}
