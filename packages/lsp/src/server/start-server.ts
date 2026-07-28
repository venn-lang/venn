import { startLanguageServer } from "langium/lsp";
import { NodeFileSystem } from "langium/node";
import type { Connection } from "vscode-languageserver";
import { createVennLspServices } from "../services/index.js";

/**
 * Start the Venn language server on an established connection. This is the one
 * wiring shared by the standalone `venn-lsp` binary and the VS Code extension.
 *
 * @param connection An LSP connection the caller has already created.
 */
export function startVennServer(connection: Connection): void {
  const { shared } = createVennLspServices({ connection, ...NodeFileSystem });
  startLanguageServer(shared);
}
