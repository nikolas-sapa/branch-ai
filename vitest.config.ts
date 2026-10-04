import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./viewer", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      ...(process.env.BRANCH_LIVE_TESTS === "1" ? [] : [
        "tests/run.test.ts", "tests/claude.test.ts", "tests/structured.test.ts",
      ]),
      ...(process.env.BRANCH_VIEWER_TESTS === "1" ? [] : ["tests/viewer-boundaries.test.ts"]),
    ],
    // All tests run sequentially in a single worker — prevents multiple
    // simultaneous Claude CLI invocations from starving each other.
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    // Live tests spawn `claude` subprocess which can flake on transient
    // network/rate-limit hiccups. Retry once before failing.
    retry: process.env.BRANCH_LIVE_TESTS === "1" ? 1 : 0,
  },
});
