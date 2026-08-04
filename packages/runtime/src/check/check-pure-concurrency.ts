import {
  type AstNode,
  buildProblem,
  CODES,
  type ForEachStmt,
  isFnDecl,
  isFnExpr,
  isForEachStmt,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * `{ concurrency: n }` on a `forEach` written inside a `fn`.
 *
 * A pure body has no scheduler to ask for a pass out of order, so a compiled
 * `forEach` runs one pass at a time no matter what its options say. The
 * option is not wrong to write, only powerless where it is written: silently
 * dropping it would leave the difference for a stopwatch to find.
 */
export function checkPureConcurrency(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isForEachStmt(node)) return [];
  const entry = concurrencyEntry(node);
  if (!entry || !insidePureBody(node)) return [];
  return [
    {
      ...buildProblem({
        spec: CODES.VN5008_CONCURRENCY_IN_A_PURE_BODY,
        span: nodeSpan(entry, ctx.uri),
        title: "A pure body runs one pass at a time, so concurrency here has no effect.",
      }),
      help: "Move the concurrent work to a fragment, which is where it belongs.",
    },
  ];
}

/**
 * The `concurrency` entry a `forEach`'s options carry, if they carry one.
 *
 * A written key is a plain string with its quotes already stripped, whether it
 * was spelled `concurrency` or `"concurrency"`, so this compares to one the way
 * every other reader of an options map does. A spread entry carries no key at
 * all, which is why `find` and not a cast.
 */
function concurrencyEntry(stmt: ForEachStmt): AstNode | undefined {
  return stmt.opts?.entries.find((entry) => entry.key === "concurrency");
}

/** Whether this node sits inside a `fn`'s body, the one place `forEach` compiles. */
function insidePureBody(node: AstNode): boolean {
  for (let at: AstNode | undefined = node.$container; at; at = at.$container) {
    if (isFnDecl(at) || isFnExpr(at)) return true;
  }
  return false;
}
