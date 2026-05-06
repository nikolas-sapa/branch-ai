/**
 * Back-compat re-export of the Claude adapter internals.
 * All real logic lives in src/adapters/claude.ts.
 * This file is preserved so existing imports of "./claude.js" keep working.
 */
export type { AllowedModel, ClaudeRun } from "./adapters/claude.js";
export { runClaude, runClaudeStream } from "./adapters/claude.js";
export type { StreamEvent } from "./adapters/types.js";
