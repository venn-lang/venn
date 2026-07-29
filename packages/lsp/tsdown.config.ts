import { defineConfig } from "tsdown";

// A library, not a binary. The executable lives in the language package, which
// is what a version of Venn installs: the orchestrator unpacks one thing per
// version, and an editor asking for the server has to find it beside the
// commands rather than in a second package that was never fetched.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  dts: true,
});
