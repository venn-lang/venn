import {
  type AstNode,
  type Call,
  CODES,
  dottedPath,
  isCall,
  isMember,
  isRef,
  type Problem,
} from "@venn-lang/core";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";

/**
 * A namespace written inside an expression, checked the way one written as a
 * statement already was.
 *
 * `print fmt.json(x)` reaches a plugin as surely as `fmt.json x` does, and until
 * now only the second was asked whether the file had brought it in. A name the
 * file binds is left alone: `page.click()` is a method on something in hand, and
 * the registry has no opinion about it.
 */
export function checkNamespaceUse(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isCall(node)) return [];
  const head = namespaceOf(node);
  if (!head || ctx.bound.has(head) || ctx.imported.has(head)) return [];
  if (!ctx.registry.hasNamespace(head)) return [];
  const title = `"${head}" is not imported in this file.`;
  const problem = problemAt({ node, ctx, spec: CODES.VN2007_NAMESPACE_NOT_IMPORTED, title });
  return [
    { ...problem, help: `Write \`import { ${head} } from "…"\` for the package it comes from.` },
  ];
}

/** The head of a dotted callee: `fmt` in `fmt.json(x)`, and nothing otherwise. */
function namespaceOf(node: Call): string | undefined {
  const path = dottedPath(node.callee);
  if (!path || !path.includes(".")) return undefined;
  return isMember(node.callee) && isRef(node.callee.receiver)
    ? path.slice(0, path.indexOf("."))
    : undefined;
}
