import type { AstNode } from "langium";
import { dottedPath } from "../../ast/index.js";
import { buildProblem, CODES } from "../../codes/index.js";
import type { ActionCall, LetStmt } from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { ProblemError } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";

/** Where a verb belongs when the pure body is a `fn` somebody wrote out. */
const IN_A_FRAGMENT = "A verb belongs in a `fragment`, or at the top level of a file.";

/**
 * Why a `fn` cannot call this, in the one sentence the language uses for it.
 *
 * One sentence with one owner, because the same mistake is reached three ways:
 * the checker reads it off the AST, and the compiler raises it from here for a
 * body it is asked to compile anyway. A verb belongs where the world can be
 * reached, and a pure body is the one place it cannot be.
 *
 * The head is invariant and the clause is not. A lambda is a pure body too, and
 * telling somebody who wrote one to move the verb "to the top level of a file"
 * is advice they cannot take, because their lambda is already there. So the
 * caller that knows which kind of body it found owns the way out, and everybody
 * else gets the one a declared `fn` needs.
 *
 * @param called The verb as it was written, dotted path and all.
 * @param instead The way out, when the caller knows a better one than a
 * `fragment`.
 * @returns The line to report, in the reader's terms.
 */
export function pureBodyCannotCall(called: string, instead: string = IN_A_FRAGMENT): string {
  return `A \`fn\` is pure, so it cannot call \`${called}\`. ${instead}`;
}

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
  refuse(stmt, dottedPath(stmt.value) ?? "a verb");
}

/**
 * A verb written as a statement of a pure body, which is every verb but `fail`.
 *
 * The grammar lets one through so the checker can name it at the line that wrote
 * it. Nothing here compiles it, so refusing is the only honest answer: a
 * statement the body compiler skipped used to stand still, and a `print` in a
 * `fn` printed nothing and said nothing.
 *
 * @param call The call, for the span the refusal points at.
 * @throws ProblemError `VN2024` always, so ask before calling it.
 */
export function refuseTheVerb(call: ActionCall): void {
  refuse(call, call.target);
}

/** The one throw, so the two ways in cannot drift into two sentences. */
function refuse(node: AstNode, called: string): never {
  throw new ProblemError(
    buildProblem({
      spec: CODES.VN2024_VERB_IN_A_PURE_BODY,
      span: spanOf(node, fileOf(node)),
      title: pureBodyCannotCall(called),
    }),
  );
}
