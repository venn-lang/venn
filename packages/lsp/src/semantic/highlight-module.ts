import { isDocument, isUseDecl, isValueImport, type ValueImport } from "@venn-lang/core";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver";
import type { HighlightArgs } from "./highlight.types.js";

const DECLARATION = SemanticTokenModifiers.declaration;

/**
 * The module header. These are plain string properties in the grammar, not
 * expression nodes, so nothing else would ever colour them.
 */
export function highlightModule(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (isDocument(node) && node.name) {
    acceptor({ node, property: "name", type: SemanticTokenTypes.namespace });
  } else if (isUseDecl(node)) {
    acceptor({ node, property: "pkg", type: SemanticTokenTypes.string });
    if (node.alias) {
      const type = SemanticTokenTypes.namespace;
      acceptor({ node, property: "alias", type, modifier: DECLARATION });
    }
  } else if (isValueImport(node)) {
    importedNames(node, args);
  }
}

function importedNames(node: ValueImport, args: HighlightArgs): void {
  const { acceptor } = args;
  acceptor({ node, property: "path", type: SemanticTokenTypes.string });
  node.names.forEach((_name, index) => {
    acceptor({ node, property: "names", index, type: SemanticTokenTypes.function });
  });
  const bound = node.wildcard ?? node.default;
  if (!bound) return;
  const property = node.wildcard ? "wildcard" : "default";
  acceptor({ node, property, type: SemanticTokenTypes.namespace, modifier: DECLARATION });
}
