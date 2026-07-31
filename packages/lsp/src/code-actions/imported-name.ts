import { isActionCall, isLetStmt, isMatcherClause, isStringLit } from "@venn-lang/core";
import type { AstNode } from "langium";
import { pathOf } from "../document/index.js";

/**
 * The name an import would have to bring in for this node to work: the matcher
 * written after `expect`, or the head of the dotted path being read.
 */
export function importedName(node: AstNode | undefined): string | undefined {
  if (!node) return undefined;
  if (isMatcherClause(node)) return node.name;
  if (isStringLit(node)) return interpolated(node as { value?: string });
  const path = isActionCall(node) ? node.target : pathOf(isLetStmt(node) ? node.value : node);
  return path?.split(".")[0];
}

/** The first namespace read inside `"…${env.X}…"`, which is what needs bringing in. */
function interpolated(node: { value?: string }): string | undefined {
  const found = (node.value ?? "").match(/\$\{\s*([A-Za-z_]\w*)\./);
  return found?.[1];
}
