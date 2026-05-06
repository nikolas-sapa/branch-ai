export type StreamEvent =
  | { type: "thinking_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "done"; full: { thinking: string; finalText: string } };

export interface ReasoningAdapter {
  /** Stable identifier — "claude" | "codex" | "gemini" */
  name: string;
  /** Human-readable label for `branch doctor` */
  label: string;
  /** Is the underlying CLI binary on PATH? */
  available(): Promise<boolean>;
  /** Does this adapter expose reasoning / thinking, or only final text? */
  exposesThinking: boolean;
  /** Non-streaming run */
  run(opts: { prompt: string; model?: string }): Promise<{ thinking: string; finalText: string }>;
  /** Streaming generator */
  runStream(opts: { prompt: string; model?: string }): AsyncGenerator<StreamEvent>;
  /** Default model string for this adapter */
  defaultModel: string;
  /** Optional model alias map */
  modelAliases?: Record<string, string>;
}
