import type { AstNode } from "langium";
import { AbstractSemanticTokenProvider, type SemanticTokenAcceptor } from "langium/lsp";
import type { SymbolCatalog } from "../catalog/index.js";
import type { VennServices } from "../services/lsp.types.js";
import { highlightCalls } from "./highlight-calls.js";
import { highlightKeywords } from "./highlight-keywords.js";
import { highlightLiterals } from "./highlight-literals.js";
import { highlightModule } from "./highlight-module.js";
import { highlightNames } from "./highlight-names.js";

/**
 * Colours a `.vn` the way §23 specifies. The grammar cannot tell `http.post`
 * from `myHelper.foo`, since both are `ActionCall`, so the catalog decides.
 * Each pass owns one family of tokens, and a node matches at most one of them.
 */
export class VennSemanticTokenProvider extends AbstractSemanticTokenProvider {
  private readonly catalog: SymbolCatalog;

  constructor(services: VennServices) {
    super(services);
    this.catalog = services.catalog;
  }

  protected override highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void {
    const args = { node, acceptor, catalog: this.catalog };
    highlightKeywords(node, acceptor);
    highlightModule(args);
    highlightCalls(args);
    highlightLiterals(args);
    highlightNames(args);
  }
}
