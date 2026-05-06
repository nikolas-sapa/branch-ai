# Changelog

## 1.0.0 — 2026-05-06

### The 1.0 release

Branch is no longer a Claude wrapper. It now works with **Claude Code, OpenAI Codex, and Google Gemini** — pluggable adapter architecture lets you point Branch at whichever AI CLI you have on PATH.

### Added

- **Multi-CLI adapter architecture** — `src/adapters/` with a common `ReasoningAdapter` interface
- **OpenAI Codex CLI adapter** (`src/adapters/codex.ts`)
- **Google Gemini CLI adapter** (`src/adapters/gemini.ts`)
- **Auto-detection** — `branch "prompt"` picks the first available CLI on PATH
- **`--cli claude|codex|gemini`** flag on `branch`, `branch replay`, `branch merge`
- **`branch doctor`** — shows which CLI adapters are available with binary paths
- **`cli` parameter** on MCP `branch_think` and `branch_replay` tools

### Changed

- README rewritten: "Claude wrapper" → "the reasoning canvas for any AI CLI"
- `branch()` SDK function auto-detects available CLI when `cli` is unset
- Each adapter has its own default model + alias map (no more hardcoded sonnet/opus/haiku across the board)
- Tool descriptions in MCP server updated for CLI-agnostic phrasing

### Backward compatible

Existing users with only Claude Code installed see no behavior change — auto-detection picks Claude as before. `runClaude` and `runClaudeStream` remain exported from `src/claude.ts` as a thin re-export of the new adapter.

---

## 0.7.3 — 2026-04-26

- **Privacy fix:** auto-share now requires explicit `BRANCH_AUTO_SHARE=1`. Previously, having `BLOB_READ_WRITE_TOKEN` set would silently auto-upload every session.
- README Privacy section + clarified env var docs.
- Obsidian plugin README updated with Privacy section.

## 0.7.2 — 2026-04-25

- Read-only hosted viewer mode — fork/inject UI hidden on non-localhost; replaced with install CTA.
- 403 server guard on fork/inject/stream API routes when accessed from a non-localhost host.
- Vercel deploy config + bundled gallery sessions.

## 0.7.1 — 2026-04-25

- MCP tool parity — 9 new tools (`branch_decide`, `branch_search`, `branch_diff`, `branch_export`, `branch_replay`, `branch_merge`, `branch_tag`, `branch_pin`, `branch_share`) bringing the total to 13.

## 0.7.0 — 2026-04-25

- `branch replay` — re-run a session with a different model.
- `branch merge` — synthesize two sessions.
- `branch watch on|off|status` — Claude Code Stop hook for auto-capture.
- `/gallery` route + curated examples in viewer.

## 0.6.0 — 2026-04-25

- Plain-English labels in user-facing UI ("Fork" → "Explore alternative", etc.).
- Default sharing (later opt-in via `BRANCH_AUTO_SHARE` in 0.7.3).
- **Decision anchors** — `branch decide` records conclusion, rejected alternatives, confidence, revisit-if. Decision panel in viewer header.

## 0.5.0 — 2026-04-25

- `branch search` + viewer search bar.
- Tags + pins.
- Provenance breadcrumbs on forked nodes.
- Auto-save partial trees on SIGINT.

## 0.4.1 — 2026-04-24

- Council week 1 floor fixes — fork visual feedback, finalText panel, click-to-expand nodes, streaming default.

## 0.4.0 — 2026-04-24

- Real-time presence with Yjs (cursors + people indicator on viewer).

## 0.3.0 — 2026-04-24

- Hosted mode — `branch share <id>` uploads to Vercel Blob.

## 0.2.1 — 2026-04-24

- Diff view — `/d/[a]/[b]` route + `branch diff` CLI command. Semantic Jaccard-similarity tree comparison.

## 0.2.0 — 2026-04-24

- Streaming reasoning tree — `--stream` flag + SSE endpoint in viewer.

## 0.1.7 — 2026-04-24

- Collapse/expand subtrees in viewer.
- MCP `branch_fork` and `branch_inject` tools.

## 0.1.6 — 2026-04-24

- `branch list` subcommand.
- Auto-open browser after CLI completes.
- Auto-start viewer if not running.

## 0.1.5 — 2026-04-24

- Structured LLM parser (Haiku second-pass for tree structure).
- Node headlines.
- `branch export` (Markdown / Mermaid).

## 0.1.0 → 0.1.4

- Initial public release. CLI + MCP server + Next.js viewer with React Flow. See git tags for incremental detail.
