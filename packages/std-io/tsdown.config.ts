import { defineConfig } from "tsdown";

// Neutral: uses the global `fetch` (available in Node, workers, browsers) — no
// `node:*` import. The plugin still requires the "net" capability at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
});
