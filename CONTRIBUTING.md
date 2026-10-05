# Contributing to Branch

## Dev setup

```bash
git clone https://github.com/nikolas-sapa/branch-ai && cd branch-ai
npm install
npm run build   # tsc, then chmod +x on dist/cli.js, dist/mcp.js, dist/hook.js
npm test        # offline fixtures, no real AI calls
```

The viewer requires Node.js 20.9 or newer (its optional Sharp image-processing dependency). The CLI supports Node.js 20 or newer.

To work on the viewer:

```bash
npm run viewer  # cd viewer && npm install && npm run dev — http://localhost:7432
```

Run `npm run test:watch` while iterating on `src/`.

Default tests use isolated local fixtures. Session tests never write to your home directory.
After installing viewer dependencies (`cd viewer && npm ci`), run `npm run test:viewer`
from the repository root for viewer access-boundary checks. Live CLI integration tests
require an installed Claude CLI and authenticated subscription, and can incur usage:
run `npm run test:live` only when you intend to make real AI calls.

## Repo layout

```
branch-ai/
├── src/adapters/  one file per AI CLI (claude.ts, codex.ts, gemini.ts, droid.ts)
├── src/cli.ts     branch command entrypoint
├── src/mcp.ts     branch-mcp server (13 tools)
├── src/run.ts     session orchestration
├── viewer/        Next.js + React Flow tree renderer
├── scripts/       feasibility test
├── tests/         vitest suite
└── dist/          build output (not committed)
```

## Adding support for a new AI CLI

This is the most common contribution. Each adapter implements `ReasoningAdapter`
from `src/adapters/types.ts`:

```ts
export interface ReasoningAdapter {
  name: string;              // stable id, e.g. "codex"
  label: string;             // shown in `branch doctor`
  available(): Promise<boolean>;
  exposesThinking: boolean;
  run(opts: { prompt: string; model?: string }): Promise<{ thinking: string; finalText: string }>;
  runStream(opts: { prompt: string; model?: string }): AsyncGenerator<StreamEvent>;
  defaultModel: string;
  modelAliases?: Record<string, string>;
}
```

Steps:

1. Copy `src/adapters/gemini.ts` as a template — it documents its own assumptions
   about CLI flags and JSON output shape inline (streaming format isn't always
   known ahead of testing against the real binary).
2. Implement `available()` (usually `which <binary>`) and `runStream()`, parsing
   stdout into `thinking_delta` / `text_delta` / `done` events.
3. Register the adapter in `src/adapters/index.ts` (add to `adapters`, export it).
4. Add a test in `tests/`, following `tests/adapters-local.test.ts` for offline process fixtures.
5. Update the "Supported CLIs" table and CLI/env docs in `README.md`.

If the target CLI has no scriptable reasoning output at all, note that limitation
in the adapter's header comment and set `exposesThinking: false`.

## PR expectations

- `npm test` passes.
- `npm run build` succeeds with no TypeScript errors.
- New adapters or commands include a test.
- Keep PRs scoped to one change; note any assumptions you couldn't verify against
  a real CLI binary (see the gemini adapter for the expected format).
