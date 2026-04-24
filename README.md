# branch-ai

A collaborative canvas for AI reasoning. Wraps the `claude` CLI to capture extended thinking as a navigable, forkable tree — you can walk backward through Claude's reasoning, fork it with a different prior at any node, or inject a new fact mid-thought and watch the cascade.

> **Why this exists.** When Claude thinks through a hard problem, the reasoning usually vanishes the moment you see the answer. Branch lets you see the thinking, rewind to any step, and explore alternative paths — without regenerating from scratch.

![viewer screenshot placeholder](https://via.placeholder.com/800x400.png?text=Branch+Viewer)

## What you get

- **`branch "prompt"`** — CLI that captures reasoning as a tree
- **`branch-mcp`** — MCP server so Claude Code agents can externalize their own reasoning
- **Web viewer** — React Flow canvas where you click any node to fork or inject a fact

## Requirements

- Node 20+
- Claude Code CLI installed and signed in (`claude` command on PATH)
- A Claude Pro, Max, or Team subscription (Branch uses your subscription via the `claude` subprocess — no Anthropic API key needed)

## Install

```bash
npm install -g branch-ai
```

## Quickstart

```bash
# Terminal 1 — start the viewer
git clone https://github.com/nikolassapalidis/branch-ai && cd branch-ai
npm run viewer
# viewer runs on http://localhost:3000 (or 3001 if 3000 busy)

# Terminal 2 — run the CLI
branch "Should I deploy on Friday afternoon? Think carefully through the tradeoffs"
# prints a session URL — open it
```

## CLI

```
branch [--model sonnet|opus|haiku] "your prompt"
```

- Default model: `sonnet` (fastest, available on Pro)
- Use `--model opus` for harder reasoning problems
- Use `--model haiku` for quick drafts

Sessions are saved to `~/.branch/sessions/<id>.json`. The viewer reads them from there.

### Environment variables

- `BRANCH_VIEWER_URL` — override where the CLI prints the viewer link. Default: `http://localhost:3000`.

## MCP server — use Branch from inside Claude Code

Add this to `~/.claude.json` under `mcpServers`:

```json
"branch": {
  "type": "stdio",
  "command": "branch-mcp",
  "env": { "BRANCH_VIEWER_URL": "http://localhost:3001" }
}
```

Restart Claude Code. From inside any CC session you'll have:

- `branch_think({ prompt, model? })` — externalize Claude's own reasoning as a tree. Returns viewer URL.
- `branch_list_sessions({ limit? })` — recent trees.

## How it works

1. CLI spawns `claude --output-format=stream-json --verbose --print "<prompt>"`
2. Parses the assistant stream for `type: "thinking"` blocks
3. Splits thinking by headings / paragraphs into a tree
4. Saves to `~/.branch/sessions/<id>.json`
5. Next.js viewer reads the file and renders it with React Flow
6. Click any node → fork (re-run with modifier) or inject-fact (re-run with new context)

## What it captures — and what it doesn't

- Captures the *surfaced* thinking blocks when extended thinking is on
- Simple factual prompts ("A or B?") often skip extended thinking → empty tree
- Tool-using sessions lose reasoning between tool calls (only pre-tool thinking is captured)
- Implicit model cognition (attention patterns, token-level reasoning) is never exposed by any API — Branch captures what Claude narrates, not everything it "thinks"

## Project structure

```
branch-ai/
├── src/           SDK + CLI + MCP server
├── viewer/        Next.js tree renderer (React Flow)
├── scripts/       feasibility test
├── tests/         vitest suite
└── dist/          published build
```

## Contributing

PRs welcome. Please run `npm test` before submitting.

## License

MIT © Nikolas Sapalidis
