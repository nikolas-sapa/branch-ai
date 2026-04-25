# LLM Council Transcript — What to ship next for Branch (branch-ai v0.4.0)

**Session ID:** 20260425-074417
**Format:** 5 advisors (parallel) → 3 peer reviewers (parallel, anonymized) → chairman synthesis

---

## Framed question

Branch (branch-ai v0.4.0) ships:
- CLI (`branch`, `branch list`, `branch export`, `branch share`, `branch diff`)
- MCP server (`branch_think`, `branch_fork`, `branch_inject`, `branch_list_sessions`)
- Next.js viewer with React Flow, click-to-fork/inject, collapsible subtrees
- `--stream` flag + SSE streaming endpoint
- Semantic diff view
- Vercel Blob hosted mode
- Yjs real-time presence
- Separate Obsidian plugin

Solo builder, personal project, public npm package at v0.1.2 (v0.4.0 unshipped).

**Question:** What features should ship next that are *genuinely valuable* — not roadmap-padding?

---

## Advisor responses

### A — The Outsider (Onboarding/positioning)

The install path is the product's biggest enemy. "Wraps the Claude CLI" assumes you already have it, know what it is, and have configured it. Three blockers before anything renders. A normal dev hitting this on npm reads "collaborative canvas for AI reasoning" and thinks: what am I looking at?

The 30-second pitch doesn't exist. "Forkable tree of AI reasoning" is internally coherent but externally meaningless. The pitch that works: *"Every time you talk to Claude, you lose the reasoning. Branch saves it as a visual map you can explore, share, and compare."*

Missing for normal users:
- **Zero-install demo** — a live hosted URL showing a real branching tree. Without it, no first impression
- **`npx branch-ai "explain recursion"`** that opens a browser tab in one shot
- **Plain-English labels.** Drop "extended thinking", "fork", "MCP" — call them "reasoning trace", "explore a different path", "tool"
- **Default sharing**, not opt-in
- **An "aha" screenshot** in the README — a complex Claude reasoning chain rendered as a tree

The features exist. The on-ramp doesn't.

### B — The Contrarian (Skeptic on scope)

The Yjs real-time presence is theater. Multiplayer for a single-player game. Cursors and people indicators solve zero problems for a developer sitting alone, thinking through a problem.

The Obsidian plugin is a distraction. Two products, 15% audience overlap, separate maintenance.

The core loop is broken and nobody's saying it. Click-to-fork injects back, but what does Claude Code do with it? If the round-trip isn't seamless, the whole value proposition collapses into a pretty visualizer nobody reopens after day two.

`branch diff` requires the user to already know which sessions to compare. Discovery is the actual problem.

What will kill it: v0.1.2 is the public version. v0.4.0 is unshipped. Real users hit a stale, broken version while the builder iterates. Ship the delta or lose them.

Fix the action loop. Kill Yjs scope. Ship v0.4.0. Everything else is fiction.

### C — The Executor (Concrete bugs) ⭐

What's on the floor everyone's stepping over:

1. **NodeDialog dead-end (2-3h, HIGH payoff).** After fork/inject, dialog calls `router.refresh()` — but the new fork has a *different* sessionId. User sees nothing change. Fix: return new sessionId from `/api/fork`, then `router.push(/t/<newId>)`. Right now every fork is a dead end.
2. **NodeCard truncates at 220 chars (1h, MEDIUM payoff).** Users can't read full reasoning. Fix: clicking text opens read-only expand panel; fork triggered separately.
3. **`--stream` should be default (30min).** Cold first-run UX goes from "is it frozen?" to immediate feedback.
4. **`finalText` invisible (1h, HIGH payoff).** Captured and stored, never shown in viewer. The thing users want to read. Add a fixed bottom panel.

Rank: 1 → 4 → 2 → 3.

### D — The First Principles Thinker (Reframe)

The surface promise is "see AI thinking as a tree." But nobody wakes up wanting *a tree*. They wake up wanting **a decision they can defend**.

The real JTBD: make AI-assisted reasoning auditable and reusable. Not just viewable — trustworthy enough to act on.

Branch captures the thinking but doesn't close the loop. You see forks, inject context, share a URL. But the user still has to manually extract "what did we actually decide?" That synthesis is the missing layer.

The genuinely valuable next feature isn't a feature — it's a primitive: **decision anchors with rationale trails**. Not summaries. Structured artifacts: *"We chose X. These branches were considered. These were rejected for Y. Confidence: medium. Revisit if Z."* Persisted, searchable, linkable.

This transforms Branch from a visualization tool into a **reasoning ledger**.

Concrete: an engineering team runs four `branch_fork` sessions on a database migration strategy. Six months later, a new engineer asks why. Today: lost. With a ledger: pull the provenance, see the live tree, understand in 90 seconds.

### E — The Expansionist (Big swing)

The hidden category isn't "AI debugging tool" — it's **collaborative reasoning infrastructure**.

**Moonshots:**
- `branch merge` — take two people's forks on the same problem, surface where they diverged. Git for thought.
- `branch replay` — re-run any session against newer Claude models. Branch becomes the reasoning regression benchmark. Anthropic wants this.
- Pivot pitch to "the reasoning layer for AI-native companies." Compliance infrastructure. Real B2B wedge.
- **Public reasoning galleries** — curated trees of how experts solved hard problems. The O'Reilly book, but alive and forkable.
- **`branch watch`** — passively captures all Claude Code activity, auto-builds reasoning history. Zero-friction adoption. Install once, value compounds silently.

The one feature for 10k installs in a week: `branch watch`.

---

## Peer review (3 reviewers, anonymized)

### Reviewer 1
**Strongest: C.** Names specific broken code with fix estimates. Defects, not opinions. Actionable in days. Others debate strategy while the product is visibly broken.

**Biggest blind spot: E.** Branch merge and replay are compelling but built on the assumption the core loop works. It doesn't. Pitching compliance infrastructure when the fork dialog shows blank is credibility-destroying. Vision without working software is a deck.

**What all five missed:** **Retention and return rate.** A tree has zero stickiness if it's orphaned. The missing feature isn't a moonshot or a bug fix — it's session continuity. Tomorrow's reopen of past trees, linkable, searchable. The product needs memory before multiplayer or pivots.

### Reviewer 2
**Strongest: C.** Identifies concrete shipping-blocking bugs with root causes and time estimates. Every other response argues strategy or framing — C tells you exactly what's broken. Act today.

**Biggest blind spot: B.** Correctly kills Yjs scope creep but misdiagnoses the problem as "action loop." The real issue C surfaces is that fork produces no visible feedback — null-state bug, not loop design. B would redesign the wrong thing.

**What all five missed:** Error handling and session persistence. Nobody asked: what happens when the LLM call fails mid-tree, when a session is interrupted, when the browser closes? If the tree isn't durable, everything D and E build collapses. Reliable write-through is the floor.

### Reviewer 3
**Strongest: C.** Concrete, actionable, high-leverage. Three-hour fixes that unblock every other bet. A broken fork dialog poisons positioning, "core loop" rhetoric, and makes D and E irrelevant.

**Biggest blind spot: B.** Correctly says fix the loop, then advocates killing scope without asking *why* users fork. If forking is for async review, Yjs presence isn't theater — it's premature. B conflates "unfinished" with "wrong direction."

**What all five missed:** **Retention over acquisition.** Every response optimizes for first impression — demo URL, onboarding, positioning, pitch. Nobody asked: do existing users come back? If session trees aren't being revisited, the whole premise collapses before B2B compliance or galleries matter. The leading indicator isn't installs — it's whether someone opens a past branch and acts on it. Fix C. Measure return visits. Then decide between D and E.

---

## Chairman synthesis

### Where the council agrees
1. The core action loop is broken (B + C)
2. `finalText` is invisible in the viewer (C)
3. The on-ramp is broken: install path + unshipped v0.4.0 (A + B)

### Where the council clashes
- **Visionary (E) vs. repair (C)** — reviewers sided unanimously with C
- **Yjs presence: theater or premature?** — B vs. R3, insufficient data
- **Onboarding (A) vs. depth (D)** — both right at different time horizons

### Blind spot caught by all 3 reviewers
**Retention.** Do users come back? Without session search, return-to-session UX, and durable persistence, the entire reasoning-ledger and compliance theses are fiction.

### Recommendation
Two-week order of operations:

**Week 1 — fix the floor:**
1. Fork dialog dead-end → `router.push(/t/<newSessionId>)`
2. Render `finalText` as fixed bottom panel
3. Click-to-expand on truncated nodes
4. Make `--stream` the default

**Week 2 — earn the return visit:**
5. `branch search "..."` + search bar in viewer home
6. Tag/pin sessions
7. Provenance link from forked node → originating question
8. Auto-save partial trees on interruption

**Defer until validated:** `branch merge`, `branch replay`, `branch watch`, public galleries, B2B pivot.

### The one thing to do first
**Fix the fork dialog dead-end.** Two hours. `router.push` to the new sessionId after fork/inject. Until that line of code lands, every other feature is a tree falling in an empty forest.
