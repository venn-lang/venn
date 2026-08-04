import { dottedPath } from "../../ast/index.js";
import { buildProblem, CODES } from "../../codes/index.js";
import type { LetStmt } from "../../generated/ast.js";
import { pureBodyCannotCall } from "../../parse/index.js";
import { ProblemError } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";

/**
 * A `let` whose trailing arguments make it a call, in a body that cannot make
 * one.
 *
 * The checker refuses this where it is written, in the same sentence. This is
 * what stops the compiler carrying on regardless, which it used to: it compiled
 * only the value, so `let stop = fail "..."` bound the callee, ran nothing, and
 * reported success.
 *
 * @param stmt The binding, for the span the refusal points at.
 * @throws ProblemError `VN2024` when the binding carries arguments or options.
 */
export function refuseACall(stmt: LetStmt): void {
  if (stmt.args.length === 0 && !stmt.opts) return;
  throw new ProblemError(
    buildProblem({
      spec: CODES.VN2024_VERB_IN_A_PURE_BODY,
      span: spanOf(stmt, ""),
      title: pureBodyCannotCall(dottedPath(stmt.value) ?? "a verb"),
    }),
  );
}
