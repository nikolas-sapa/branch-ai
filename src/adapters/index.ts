import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { geminiAdapter } from "./gemini.js";
import { droidAdapter } from "./droid.js";
import type { ReasoningAdapter } from "./types.js";

export { claudeAdapter } from "./claude.js";
export { codexAdapter } from "./codex.js";
export { geminiAdapter } from "./gemini.js";
export { droidAdapter } from "./droid.js";
export type { ReasoningAdapter, StreamEvent } from "./types.js";

export const adapters: ReasoningAdapter[] = [claudeAdapter, codexAdapter, geminiAdapter, droidAdapter];

export function getAdapter(name: string): ReasoningAdapter {
  const a = adapters.find((x) => x.name === name);
  if (!a) {
    throw new Error(
      `Unknown CLI adapter: ${name}. Available: ${adapters.map((a) => a.name).join(", ")}`
    );
  }
  return a;
}

export async function detectAvailableAdapter(): Promise<ReasoningAdapter | null> {
  for (const a of adapters) {
    if (await a.available()) return a;
  }
  return null;
}
