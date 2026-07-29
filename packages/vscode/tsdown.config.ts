import { defineConfig } from "tsdown";

// A VS Code extension must be self-contained: bundle it with every dependency,
// so the installed folder needs no node_modules. Only `vscode` stays external,
// since the editor provides it at runtime. Output is `.cjs` because the
// extension host loads CommonJS.
//
// The server is no longer among them. It comes from where `venn` keeps its
// versions, so the editor answers on the same version as the command line.
export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  platform: "node",
  deps: { alwaysBundle: [/.*/], neverBundle: ["vscode"] },
  dts: false,
  outDir: "dist",
});
