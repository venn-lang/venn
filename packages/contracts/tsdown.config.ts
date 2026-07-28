import { defineConfig } from "tsdown";

// Two build passes enforce the neutrality boundary at build time:
// - index + testing must be Web-Worker-safe → platform "neutral" (any `node:*`
//   import fails the build).
// - node holds the node:*-backed impls (node-fs, createNodeHost) → platform "node".
export default defineConfig([
  {
    // vitest / @fast-check/vitest are peerDependencies → externalized automatically.
    entry: ["src/index.ts", "src/testing.ts"],
    format: ["esm"],
    platform: "neutral",
    dts: true,
  },
  {
    entry: ["src/node.ts"],
    format: ["esm"],
    platform: "node",
    dts: true,
  },
]);
