import { defineConfig } from "tsdown";

// The language server targets Node (stdio transport + NodeFileSystem), so it
// builds like the CLI: `.mjs`, with `bin/venn-lsp.ts` as the executable.
export default defineConfig({
  entry: ["src/index.ts", "src/bin/venn-lsp.ts"],
  format: ["esm"],
  platform: "node",
  dts: true,
});
