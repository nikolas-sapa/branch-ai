/**
 * MCP install/uninstall/status helpers.
 * Wires the branch-mcp server into AI client config files.
 *
 * Supported clients:
 *   claude-code     ~/.claude.json                              (JSON)
 *   claude-desktop  ~/Library/Application Support/Claude/...   (JSON, macOS/Windows)
 *   cursor          ~/.cursor/mcp.json                         (JSON)
 *   codex           ~/.codex/config.toml                       (TOML)
 *   cline           ~/.config/Cline/MCP/cline_mcp_settings.json (JSON)
 *
 * ASSUMPTIONS for Codex TOML:
 *   - Codex CLI reads MCP servers from ~/.codex/config.toml under an [mcp_servers.branch] table.
 *   - The table shape mirrors the JSON config: command + env sub-table.
 *   - ASSUMPTION: the exact TOML key is `mcp_servers` (not `mcpServers`). Update if the real
 *     Codex CLI uses a different section name.
 *   - We hand-roll a minimal TOML emitter rather than pulling in a full TOML library.
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { rename } from "node:fs/promises";

// ── Config block ──────────────────────────────────────────────────────────────

const BRANCH_MCP_ENTRY = {
  command: "branch-mcp",
  env: { BRANCH_VIEWER_URL: "http://localhost:7432" },
};

// ── Client definitions ────────────────────────────────────────────────────────

function claudeCodeConfigPath(): string {
  return join(homedir(), ".claude.json");
}

function claudeDesktopConfigPath(): string {
  if (platform() === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
}

function cursorConfigPath(): string {
  return join(homedir(), ".cursor", "mcp.json");
}

function codexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

function clineConfigPath(): string {
  return join(homedir(), ".config", "Cline", "MCP", "cline_mcp_settings.json");
}

export const CLIENT_CONFIGS: Record<string, { path: () => string; format: "json" | "toml"; label: string }> = {
  "claude-code":     { path: claudeCodeConfigPath,     format: "json", label: "Claude Code" },
  "claude-desktop":  { path: claudeDesktopConfigPath,  format: "json", label: "Claude Desktop" },
  "cursor":          { path: cursorConfigPath,          format: "json", label: "Cursor" },
  "codex":           { path: codexConfigPath,           format: "toml", label: "Codex CLI" },
  "cline":           { path: clineConfigPath,           format: "json", label: "Cline" },
};

// ── Atomic write ──────────────────────────────────────────────────────────────

async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = join(filePath, "..");
  await mkdir(dir, { recursive: true });
  const tmp = join(tmpdir(), `branch-mcp-${randomBytes(6).toString("hex")}.tmp`);
  await writeFile(tmp, content, "utf8");
  await rename(tmp, filePath);
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

async function readJson(filePath: string): Promise<any> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function hasBranchJson(config: any): boolean {
  return !!(config?.mcpServers?.branch);
}

async function installJson(filePath: string): Promise<void> {
  const config = await readJson(filePath);
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers.branch = BRANCH_MCP_ENTRY;
  await atomicWriteFile(filePath, JSON.stringify(config, null, 2) + "\n");
}

async function uninstallJson(filePath: string): Promise<void> {
  const config = await readJson(filePath);
  if (config?.mcpServers?.branch) {
    delete config.mcpServers.branch;
    await atomicWriteFile(filePath, JSON.stringify(config, null, 2) + "\n");
  }
}

// ── TOML helpers (minimal hand-rolled emitter for Codex config) ───────────────

/**
 * Reads the entire TOML file as raw text (we do line-based manipulation to avoid
 * needing a full TOML parser). We locate or append an [mcp_servers.branch] section.
 *
 * ASSUMPTION: The Codex TOML config uses [mcp_servers.branch] as the section header.
 */
async function readTomlRaw(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

/** The TOML block we inject. */
function branchTomlBlock(): string {
  return [
    "[mcp_servers.branch]",
    `command = "branch-mcp"`,
    ``,
    `[mcp_servers.branch.env]`,
    `BRANCH_VIEWER_URL = "http://localhost:7432"`,
    ``,
  ].join("\n");
}

function hasBranchToml(raw: string): boolean {
  return /^\[mcp_servers\.branch\]/m.test(raw);
}

async function installToml(filePath: string): Promise<void> {
  let raw = await readTomlRaw(filePath);
  if (hasBranchToml(raw)) {
    // Already present — nothing to do
    return;
  }
  // Append the block (separated by a blank line)
  const separator = raw.length > 0 && !raw.endsWith("\n\n") ? "\n" : "";
  raw = raw + separator + branchTomlBlock();
  await atomicWriteFile(filePath, raw);
}

async function uninstallToml(filePath: string): Promise<void> {
  let raw = await readTomlRaw(filePath);
  if (!hasBranchToml(raw)) return;

  // Remove the [mcp_servers.branch] and [mcp_servers.branch.env] sections.
  // We remove all lines belonging to those two sections until the next top-level section or EOF.
  const lines = raw.split("\n");
  const out: string[] = [];
  let inBranchSection = false;

  for (const line of lines) {
    const isBranchSection = /^\[mcp_servers\.branch(\..*)?\]/.test(line);
    const isOtherSection = /^\[/.test(line) && !isBranchSection;

    if (isBranchSection) {
      inBranchSection = true;
      continue;
    }
    if (isOtherSection) {
      inBranchSection = false;
    }
    if (!inBranchSection) {
      out.push(line);
    }
  }

  // Trim trailing blank lines left by removal
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  await atomicWriteFile(filePath, out.join("\n") + (out.length > 0 ? "\n" : ""));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function mcpInstall(client: string): Promise<void> {
  const def = CLIENT_CONFIGS[client];
  if (!def) {
    console.error(`Unknown client: ${client}`);
    console.error(`Supported: ${Object.keys(CLIENT_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const filePath = def.path();
  try {
    if (def.format === "toml") {
      await installToml(filePath);
    } else {
      await installJson(filePath);
    }
    console.log(`  ${def.label}: installed branch-mcp → ${filePath}`);
  } catch (err: any) {
    console.error(`  ${def.label}: failed — ${err?.message}`);
    process.exit(1);
  }
}

export async function mcpUninstall(client: string): Promise<void> {
  const def = CLIENT_CONFIGS[client];
  if (!def) {
    console.error(`Unknown client: ${client}`);
    console.error(`Supported: ${Object.keys(CLIENT_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const filePath = def.path();
  try {
    if (def.format === "toml") {
      await uninstallToml(filePath);
    } else {
      await uninstallJson(filePath);
    }
    console.log(`  ${def.label}: removed branch-mcp from ${filePath}`);
  } catch (err: any) {
    console.error(`  ${def.label}: failed — ${err?.message}`);
    process.exit(1);
  }
}

export async function mcpInstallAll(): Promise<void> {
  console.log("\nInstalling branch-mcp into all supported clients...\n");
  for (const client of Object.keys(CLIENT_CONFIGS)) {
    await mcpInstall(client);
  }
  console.log("\nDone. Run `branch mcp status` to verify.\n");
}

export async function mcpStatus(): Promise<void> {
  const GREEN = "\x1b[32m";
  const RED = "\x1b[31m";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";

  const CHECK = `${GREEN}✓ installed${RESET}`;
  const CROSS = `${RED}✗ not installed${RESET}`;
  const DASH  = `${DIM}— config file not found${RESET}`;

  const clientWidth = Math.max(...Object.keys(CLIENT_CONFIGS).map((k) => k.length)) + 2;

  console.log("");
  for (const [client, def] of Object.entries(CLIENT_CONFIGS)) {
    const filePath = def.path();
    const padded = client.padEnd(clientWidth);

    if (!existsSync(filePath)) {
      console.log(`  ${padded}${DASH}   ${DIM}${filePath}${RESET}`);
      continue;
    }

    let installed = false;
    try {
      if (def.format === "toml") {
        const raw = await readTomlRaw(filePath);
        installed = hasBranchToml(raw);
      } else {
        const config = await readJson(filePath);
        installed = hasBranchJson(config);
      }
    } catch {
      installed = false;
    }

    const status = installed ? CHECK : `${CROSS}   ${DIM}(file exists but no branch entry)${RESET}`;
    console.log(`  ${padded}${status}   ${DIM}${filePath}${RESET}`);
  }
  console.log("");
}
