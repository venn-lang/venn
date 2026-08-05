import { defineConfig } from "tsdown";

// Neutral: every byte this plugin reads or writes travels through the
// FileSystem port, so nothing here imports `node:*` and the editor's worker
// loads the same build the CLI does.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
});
