import { defineConfig } from "tsdown";

// A VS Code extension must be self-contained: bundle the client and the server
// with every dependency, so the installed folder needs no node_modules. Only
// `vscode` stays external — the editor provides it at runtime. Output is `.cjs`
// because the extension host loads CommonJS.
export default defineConfig({
  entry: ["src/extension.ts", "src/server.ts"],
  format: ["cjs"],
  platform: "node",
  deps: { alwaysBundle: [/.*/], neverBundle: ["vscode"] },
  dts: false,
  outDir: "dist",
});
