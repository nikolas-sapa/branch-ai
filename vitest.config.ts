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
  },
});
