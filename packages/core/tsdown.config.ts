import { defineConfig } from "tsdown";

// platform "neutral": @venn-lang/core must run in a Web Worker (LSP) as well as Node,
// so any `node:*` import fails the build. langium is a dependency → externalized.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
});
