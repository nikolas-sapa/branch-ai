import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // All tests run sequentially in a single worker — prevents multiple
    // simultaneous Claude CLI invocations from starving each other.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Live tests spawn `claude` subprocess which can flake on transient
    // network/rate-limit hiccups. Retry once before failing.
    retry: 1,
  },
});
