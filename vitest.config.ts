import { defineConfig } from "vitest/config";

// Root aggregator: runs every package's Vitest project in one process.
// Each package owns its own vitest.config.ts (resolved via the "development"
// export condition so tests run against src, never dist).
export default defineConfig({
  resolve: { conditions: ["development"] },
  test: {
    projects: ["packages/*"],
  },
});
