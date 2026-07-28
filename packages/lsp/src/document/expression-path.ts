import { type AstNode, type Expr, isMember, isRef } from "@venn-lang/core";
import type { SymbolCatalog } from "../catalog/index.js";
import { findBinding } from "./find-binding.js";

/** The dotted path an expression spells, or undefined when it is not a plain one. */
export function pathOf(expr: Expr | AstNode | undefined): string | undefined {
  if (!expr) return undefined;
  if (isRef(expr)) return expr.name;
  if (!isMember(expr) || expr.optional) return undefined;
  const receiver = pathOf(expr.receiver);
  return receiver === undefined ? undefined : `${receiver}.${expr.member}`;
}

/**
 * The action a path names, if the catalog knows it. `let auth = http.post …`
 * spells a call as a member chain; only the catalog can tell that apart from
 * `res.status`, and both the colours and the hover need the same answer.
 */
export function stdlibAction(
  node: AstNode | undefined,
  catalog: SymbolCatalog,
): string | undefined {
  const path = pathOf(outermost(node));
  const dot = path?.indexOf(".") ?? -1;
  if (!path || dot < 0 || !node) return undefined;
  // A name in scope always wins, so a variable called `auth` stays a variable
  // however many stdlib namespaces happen to share its name.
  if (findBinding(node, path.slice(0, dot))) return undefined;
  return catalog.action(path.slice(0, dot), path.slice(dot + 1)) ? path : undefined;
}

/** Climb to the end of the member chain: from `http` in `http.post`, to `http.post`. */
function outermost(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (
    current?.$container &&
    isMember(current.$container) &&
    current.$container.receiver === current
  ) {
    current = current.$container;
  }
  return current;
}
