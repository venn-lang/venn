import { isDocument, isValueImport, type ValueImport } from "@venn-lang/core";
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
  } else if (isValueImport(node)) {
    importedNames(node, args);
  }
}

function importedNames(node: ValueImport, args: HighlightArgs): void {
  const { acceptor } = args;
  acceptor({ node, property: "path", type: SemanticTokenTypes.string });
  for (const one of node.names) {
    acceptor({ node: one, property: "name", type: SemanticTokenTypes.function });
    // The name it is given here is what the rest of the file writes, and what
    // it names is a bag of verbs, so it is coloured as one.
    if (one.alias) {
      acceptor({
        node: one,
        property: "alias",
        type: SemanticTokenTypes.namespace,
        modifier: DECLARATION,
      });
    }
  }
  const bound = node.wildcard ?? node.default;
  if (!bound) return;
  const property = node.wildcard ? "wildcard" : "default";
  acceptor({ node, property, type: SemanticTokenTypes.namespace, modifier: DECLARATION });
}
