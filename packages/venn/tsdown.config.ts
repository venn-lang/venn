import { defineConfig } from "tsdown";

// One file, bundled, so starting up opens one file rather than walking a
// dependency tree. The orchestrator runs before every command, so what it
// costs is paid every time.
export default defineConfig({
  entry: { "bin/venn": "src/bin/venn.ts", "bin/prepare": "src/bin/prepare.ts" },
  format: ["esm"],
  platform: "node",
  deps: { alwaysBundle: [/.*/] },
  dts: false,
});
