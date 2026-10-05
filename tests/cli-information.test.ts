import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

describe("CLI information flags", () => {
  it.each(["--help", "-h", "--version", "-V"])("%s exits without side effects", (flag) => {
    const fixture = mkdtempSync(resolve(root, "../followup-branch-help-test-"));
    const activity = join(fixture, "activity.jsonl");
    const preload = join(fixture, "guard.mjs");
    writeFileSync(activity, "");
    writeFileSync(preload, `
import fs from "node:fs";
import promises from "node:fs/promises";
import os from "node:os";
import childProcess from "node:child_process";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import ${JSON.stringify(join(root, "node_modules/tsx/dist/cjs/index.cjs"))};
import ${JSON.stringify(join(root, "node_modules/tsx/dist/esm/index.mjs"))};
const record = fs.writeSync.bind(fs, fs.openSync(${JSON.stringify(activity)}, "a"));
const exit = process.exit.bind(process);
const block = (name) => (...args) => {
  record(JSON.stringify({ blocked: name, stack: new Error().stack }) + "\\n");
  exit(90);
};
const patch = (target, names, prefix) => {
  for (const name of names) if (typeof target[name] === "function") target[name] = block(prefix + name);
};
os.homedir = () => ${JSON.stringify(fixture)};
patch(childProcess, ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"], "child_process.");
globalThis.fetch = block("fetch");
patch(net, ["connect", "createConnection", "createServer"], "net.");
patch(net.Socket.prototype, ["connect"], "net.Socket.");
patch(net.Server.prototype, ["listen"], "net.Server.");
patch(http, ["request", "get", "createServer"], "http.");
patch(https, ["request", "get", "createServer"], "https.");
patch(tls, ["connect", "createServer"], "tls.");
patch(dns, Object.keys(dns).filter((name) => /^(lookup|resolve|reverse)/.test(name)), "dns.");
patch(dns.promises, Object.keys(dns.promises).filter((name) => /^(lookup|resolve|reverse)/.test(name)), "dns.promises.");
const writes = ["appendFile", "writeFile", "write", "writev", "mkdir", "mkdtemp", "rename", "unlink", "rmdir", "rm", "copyFile", "cp", "truncate", "ftruncate", "symlink", "link", "chmod", "fchmod", "chown", "fchown", "lchown", "utimes", "futimes", "lutimes", "createWriteStream"];
patch(fs, writes.flatMap((name) => [name, name + "Sync"]), "fs.");
patch(promises, writes, "fs.promises.");
const writable = (flags) => typeof flags === "string" ? /[wax+]/.test(flags) : Boolean(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND));
for (const [target, name, prefix] of [[fs, "open", "fs."], [fs, "openSync", "fs."], [promises, "open", "fs.promises."]]) {
  const original = target[name];
  target[name] = function (...args) {
    if (writable(args[1])) block(prefix + name)(...args);
    return Reflect.apply(original, this, args);
  };
}
syncBuiltinESMExports();
`);
    try {
      const child = spawnSync(process.execPath, ["--import", "tsx", "--import", preload,
        join(root, "src/cli.ts"), flag], { cwd: root, encoding: "utf8", timeout: 15_000,
        env: { ...process.env, TSX_DISABLE_CACHE: "1" } });
      expect(child.error).toBeUndefined();
      expect(child.status, `${child.stderr}\n${readFileSync(activity, "utf8")}`).toBe(0);
      expect(child.stderr).toBe("");
      if (flag === "--help" || flag === "-h") expect(child.stdout).toMatch(/^Usage:/);
      else expect(child.stdout).toBe(`${version}\n`);
      expect(readFileSync(activity, "utf8")).toBe("");
      expect(existsSync(join(fixture, ".branch", "sessions"))).toBe(false);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
