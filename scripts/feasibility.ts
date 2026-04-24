import { runClaude } from "../src/claude.js";

const prompts = [
  "Think step by step: is 1000007 prime? Show your reasoning.",
  "A user reports login fails only on Safari. Reason through the likely causes.",
  "Should I deploy on Friday afternoon? Weigh the tradeoffs.",
  "Explain step by step why async/await is preferred over callbacks in modern JS.",
  "Plan a 3-day trip to Kyoto for a first-time visitor. Think about tradeoffs.",
  "Debug: my React component re-renders infinitely. Think about what could cause it.",
  "A startup has $100k left and 6 months runway. Reason through their options.",
  "Which is a better database for a todo app: SQLite or Postgres? Justify.",
  "Write a haiku about autumn. Think first about what image to capture.",
  "Should I refactor now or ship? Reason through the decision.",
];

async function main() {
  const results: { prompt: string; thinkingLen: number; ok: boolean }[] = [];
  for (const prompt of prompts) {
    process.stdout.write(`Running: ${prompt.slice(0, 50)}... `);
    try {
      const r = await runClaude({ prompt, model: "sonnet" });
      const ok = r.thinking.length >= 100;
      results.push({ prompt, thinkingLen: r.thinking.length, ok });
      console.log(ok ? `OK (${r.thinking.length} chars)` : `SHALLOW (${r.thinking.length})`);
    } catch (e) {
      results.push({ prompt, thinkingLen: 0, ok: false });
      console.log("ERROR");
    }
  }
  const passRate = results.filter((r) => r.ok).length / results.length;
  console.log(`\nPass rate: ${(passRate * 100).toFixed(0)}%`);
  console.log(`KILL CRITERION: ${passRate < 0.5 ? "FAILED — pivot" : "PASSED — proceed"}`);
  process.exit(passRate < 0.5 ? 1 : 0);
}
main();
