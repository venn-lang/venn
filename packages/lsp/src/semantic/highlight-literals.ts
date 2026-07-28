import {
  isBoolLit,
  isInstantLit,
  isMapEntry,
  isMember,
  isNamedType,
  isNullLit,
  isNumberLit,
  isRef,
  isStringLit,
} from "@venn-lang/core";
import { SemanticTokenTypes } from "vscode-languageserver";
import type { HighlightArgs } from "./highlight.types.js";
import { highlightInterpolation } from "./highlight-interpolation.js";
import { highlightPath } from "./highlight-paths.js";

/** Literals, references and type names inside expressions. */
export function highlightLiterals(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (isStringLit(node)) {
    // An interpolated string is painted piece by piece; tokens cannot overlap.
    if (!highlightInterpolation(args)) {
      acceptor({ node, property: "value", type: SemanticTokenTypes.string });
    }
  } else if (isNumberLit(node))
    acceptor({ node, property: "raw", type: SemanticTokenTypes.number });
  else if (isInstantLit(node))
    acceptor({ node, property: "value", type: SemanticTokenTypes.number });
  else if (isBoolLit(node)) acceptor({ node, property: "value", type: SemanticTokenTypes.keyword });
  // A stdlib path (`http.post`) is a call, not a variable; the catalog decides.
  else if (isRef(node) || isMember(node)) {
    if (!highlightPath(args) && isRef(node)) {
      acceptor({ node, property: "name", type: SemanticTokenTypes.variable });
    }
  } else if (isNamedType(node)) acceptor({ node, property: "name", type: SemanticTokenTypes.type });
  else if (isMapEntry(node)) acceptor({ node, property: "key", type: SemanticTokenTypes.property });
  else if (isNullLit(node)) acceptor({ node, keyword: "null", type: SemanticTokenTypes.keyword });
}
