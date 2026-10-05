import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAdapter } from "../src/adapters/claude.js";
import { codexAdapter } from "../src/adapters/codex.js";
import { droidAdapter } from "../src/adapters/droid.js";
import { geminiAdapter } from "../src/adapters/gemini.js";

const adapters = [claudeAdapter, codexAdapter, droidAdapter, geminiAdapter];
let dir: string;
let path: string | undefined;
function fixture(name: string, body: string) {
  writeFileSync(join(dir, name), `#!${process.execPath}\n${body}`, { mode: 0o755 });
}
async function collect(adapter: typeof codexAdapter) {
  const events = [];
  for await (const event of adapter.runStream({ prompt: "local fixture only" })) events.push(event);
  return events;
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "branch-adapters-"));
  path = process.env.PATH;
  process.env.PATH = `${dir}:/usr/bin:/bin`;
});
afterEach(() => { process.env.PATH = path; rmSync(dir, { recursive: true, force: true }); });

describe.each(adapters)("$name local subprocess", (adapter) => {
  it("rejects run and stream on exit 7, retaining stderr", async () => {
    fixture(adapter.name, 'process.stderr.write("fixture failure diagnostic"); process.exitCode = 7;');
    await expect(adapter.run({ prompt: "local fixture only" })).rejects.toThrow(/fixture failure diagnostic/);
    await expect(collect(adapter)).rejects.toThrow(/exit.*7/);
  });
  it("rejects failure after stdout closes without emitting done", async () => {
    fixture(adapter.name, 'process.stdout.end(); setTimeout(() => { process.stderr.write("late diagnostic"); process.exitCode = 7; }, 30);');
    const events = [];
    let failure: Error | undefined;
    try {
      for await (const event of adapter.runStream({ prompt: "local fixture only" })) events.push(event);
    } catch (error) { failure = error as Error; }
    expect(failure?.message).toContain("late diagnostic");
    expect(events.some((event) => event.type === "done")).toBe(false);
  });
  it("rejects signal termination", async () => {
    fixture(adapter.name, 'process.kill(process.pid, "SIGTERM");');
    await expect(collect(adapter)).rejects.toThrow(/signal SIGTERM/);
  });
  it("bounds failure diagnostics", async () => {
    fixture(adapter.name, 'process.stderr.write("x".repeat(100000) + "diagnostic tail"); process.exitCode = 7;');
    let failure: Error | undefined;
    try { await collect(adapter); } catch (error) { failure = error as Error; }
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toContain("diagnostic tail");
    expect(failure!.message.length).toBeLessThan(5000);
  });
  it("rejects spawn errors without hanging", async () => {
    writeFileSync(join(dir, adapter.name), "#!/nonexistent/branch-fixture-interpreter\n", { mode: 0o755 });
    await expect(adapter.run({ prompt: "local fixture only" })).rejects.toThrow();
    await expect(collect(adapter)).rejects.toThrow();
  });
});

for (const adapter of [codexAdapter, droidAdapter]) {
  it(`${adapter.name} parses final NDJSON without newline and split UTF8`, async () => {
    fixture(adapter.name, 'const b = Buffer.from(JSON.stringify({ type: "output_text", text: "hello 🌍" })); const i = b.indexOf(Buffer.from("🌍")); process.stdout.write(b.subarray(0,i+1)); setTimeout(() => process.stdout.end(b.subarray(i+1)), 30);');
    await expect(adapter.run({ prompt: "local fixture only" })).resolves.toEqual({ thinking: "", finalText: "hello 🌍" });
  });
}
it("Codex uses exec JSON mode and separates positional prompt", async () => {
  fixture("codex", 'console.log(JSON.stringify({type:"output_text",text:JSON.stringify(process.argv.slice(2))}));');
  const result = await codexAdapter.run({ prompt: "--dangerous-looking prompt", model: "fixture-model" });
  expect(JSON.parse(result.finalText)).toEqual(["exec", "--json", "--model", "fixture-model", "--", "--dangerous-looking prompt"]);
});

it("Codex reads completed reasoning and message items", async () => {
  fixture("codex", 'console.log(JSON.stringify({type:"item.completed",item:{type:"reasoning",text:"reason"}})); console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"answer"}}));');
  await expect(codexAdapter.run({ prompt: "local fixture only" })).resolves.toEqual({ thinking: "reason", finalText: "answer" });
});
it("Claude parses EOF JSON with split UTF8", async () => {
  fixture("claude", 'const b = Buffer.from(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"hello 🌍"}]}})); const i = b.indexOf(Buffer.from("🌍")); process.stdout.write(b.subarray(0,i+1)); setTimeout(() => process.stdout.end(b.subarray(i+1)), 30);');
  await expect(claudeAdapter.run({ prompt: "local fixture only" })).resolves.toMatchObject({ thinking: "", finalText: "hello 🌍" });
  expect((await collect(claudeAdapter)).at(-1)).toEqual({type:"done",full:{thinking:"",finalText:"hello 🌍"}});
});
it("Gemini preserves plain text with split UTF8", async () => {
  fixture("gemini", 'const b = Buffer.from("hello 🌍"); const i = b.indexOf(Buffer.from("🌍")); process.stdout.write(b.subarray(0,i+1)); setTimeout(() => process.stdout.end(b.subarray(i+1)), 30);');
  await expect(geminiAdapter.run({ prompt: "local fixture only" })).resolves.toEqual({ thinking: "", finalText: "hello 🌍" });
});
