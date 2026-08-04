import {
  type AstNode,
  buildProblem,
  CODES,
  isFnDecl,
  isFnExpr,
  isLetStmt,
  type LetStmt,
  type Problem,
  pureBodyCannotCall,
} from "@venn-lang/core";
import { actionTarget, nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A verb called from inside a `fn`, written as the binding of its result.
 *
 * The grammar refuses `io.print "x"` in a pure body, and it cannot refuse
 * `let a = io.print "x"`: the trailing argument is what makes a `let` a call,
 * and the rule that reads it lives in `LetStmt`, which a pure body may hold.
 * So the same line, with two words in front of it, parsed, checked clean, and
 * then did nothing at all, because a compiled body reads only the value and
 * never the arguments beside it.
 *
 * Refused here rather than dropped, and in the sentence the bare form already
 * gets, because the two are one mistake.
 */
export function checkPureVerb(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isLetStmt(node) || !carriesACall(node) || !insideAPureBody(node)) return [];
  const target = actionTarget(node.value) ?? "a verb";
  return [
    buildProblem({
      spec: CODES.VN2024_VERB_IN_A_PURE_BODY,
      span: nodeSpan(node, ctx.uri),
      title: pureBodyCannotCall(target),
    }),
  ];
}

/** Trailing arguments or a trailing options map: what makes a `let` a call. */
function carriesACall(stmt: LetStmt): boolean {
  return stmt.args.length > 0 || stmt.opts !== undefined;
}

/** Whether this node sits inside a `fn`'s body, which is pure at every depth. */
function insideAPureBody(node: AstNode): boolean {
  for (let at: AstNode | undefined = node.$container; at; at = at.$container) {
    if (isFnDecl(at) || isFnExpr(at)) return true;
  }
  return false;
}
