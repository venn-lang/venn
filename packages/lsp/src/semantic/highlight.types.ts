import type { AstNode } from "@venn/core";
import type { SemanticTokenAcceptor } from "langium/lsp";
import type { SymbolCatalog } from "../catalog/index.js";

/** What a highlight pass needs: the node, where to emit, and symbol resolution. */
export interface HighlightArgs {
  node: AstNode;
  acceptor: SemanticTokenAcceptor;
  catalog: SymbolCatalog;
}
