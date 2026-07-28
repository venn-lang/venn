import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["development"] },
  test: {
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: [/^@venn-lang\//] } },
    // Each case writes a package to disk and starts the TypeScript compiler on
    // it. That is seconds of honest work, and the default five is enough only
    // on an idle machine: under coverage, or on a shared runner, it is not.
    testTimeout: 30_000,
  },
});
