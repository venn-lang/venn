import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `vscode` is provided by the extension host and cannot be installed, so a test
// that activates the extension gets the stub instead. Everything the extension
// decides for itself lives away from this boundary and needs no such thing.
const VSCODE = fileURLToPath(new URL("./src/vscode.stub.ts", import.meta.url));

export default defineConfig({
  resolve: {
    conditions: ["development"],
    alias: { vscode: VSCODE },
  },
  test: {
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: [/^@venn-lang\//] } },
  },
});
