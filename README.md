# Branch

Reasoning as a shared document. Wrap Claude Code subprocess calls, capture extended thinking as a navigable tree, fork and inject facts mid-reasoning.

## Quickstart

```bash
git clone <your-repo> branch && cd branch
npm install
npm run build
npm link   # makes `branch` command available globally

cd viewer && npm install && npm run dev &
cd ..

branch "Should I use SQLite or Postgres for a todo app? Think carefully."
# Opens viewer at http://localhost:3000/t/<sessionId>
```

## Requirements
- Node 24+
- Claude Code CLI signed in (`claude` command works)
- Claude Pro, Max, or Team subscription

## Commands
- `branch "prompt"` — run with default model (Sonnet)
- `branch --model opus "prompt"` — escalate to Opus for hard problems
- `branch --model haiku "prompt"` — fast draft

## How it works
1. CLI spawns `claude --output-format=stream-json --print "<prompt>"`
2. Parses assistant message for `type: "thinking"` blocks
3. Breaks thinking into a tree by headings and paragraphs
4. Saves to `~/.branch/sessions/<id>.json`
5. Viewer (Next.js) reads that file and renders it

## Project structure
```
branch/
├── src/           # SDK + CLI
├── viewer/        # Next.js tree renderer
├── scripts/       # feasibility test
└── tests/
```
