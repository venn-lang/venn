import { defineConfig } from "tsdown";

// Two passes enforce the boundary at build time, the way @venn/contracts does:
// - the main entry uses the global `fetch` and must stay Worker-safe → "neutral",
//   so any `node:*` import fails the build rather than shipping quietly.
// - the node entry holds the server that binds a real socket → "node".
export default defineConfig([
  {
    entry: ["src/index.ts"],
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
