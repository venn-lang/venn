import { type AstNode, buildProblem, CODES, isNamespaceDecl, type Problem } from "@venn-lang/core";
import { heldByANamespace, nodeSpan, wordFor } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A declaration written inside a `namespace` that a namespace cannot hold.
 *
 * The grammar admits any declaration there and nothing downstream walked into
 * one: not the runner, not `venn list`, not the type checker, not the graph. So
 * a `flow` moved inside a namespace to group it was not listed, not run and not
 * type checked, and `venn test` still exited 0. A plain statement written there
 * simply never ran.
 *
 * Refused rather than made to work, because a namespace is a way of grouping
 * names and a flow is not a name.
 */
export function checkNamespaceBody(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isNamespaceDecl(node)) return [];
  return node.decls.filter((held) => !heldByANamespace(held)).map((held) => refuse(held, ctx));
}

function refuse(held: AstNode, ctx: CheckContext): Problem {
  return {
    ...buildProblem({
      spec: CODES.VN2025_NOT_A_NAMESPACE_MEMBER,
      span: nodeSpan(held, ctx.uri),
      title: `A namespace groups names, so it cannot hold ${wordFor(held)}.`,
    }),
    help: "Move it to the top level of the file.",
  };
}
