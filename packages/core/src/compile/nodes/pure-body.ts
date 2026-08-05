import type { AstNode } from "langium";
import { dottedPath } from "../../ast/index.js";
import { buildProblem, CODES } from "../../codes/index.js";
import {
  type ActionCall,
  type FnExpr,
  isActionCall,
  isArg,
  isFnDecl,
  isFnExpr,
  type LetStmt,
} from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { ProblemError } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";

/**
 * The one verb a pure body may run.
 *
 * A raise is control flow rather than an effect on the world: it ends the body
 * instead of reaching out of it, so it answers the same way for the same
 * arguments wherever it is written. One owner for the name, because a body that
 * refuses it in one path and compiles it in another is two languages.
 */
export const RAISES = "fail";

/** The way out of a body that has a name, or a call somebody can move. */
const IN_A_FRAGMENT = "A verb belongs in a `fragment`, or at the top level of a file.";

/**
 * The way out of a lambda written in the middle of a call, which has neither.
 *
 * A callback cannot be renamed into a `fragment`, and lifting it to the top level
 * of a file loses the one thing it is for, an answer per element. A loop has
 * statements to write the verb in and a name to keep the answers under, so it is
 * the way out that runs.
 *
 * The `…` stands for the call as the reader wrote it rather than a
 * reconstruction of it, because the verb's arity is not known here and a
 * suggestion that does not run is worse than none. Same shape
 * `helpAboutNothing` uses for `?? …`.
 *
 * Nothing here offers to throw the answers away. Whatever called the method
 * keeps the value of a callback, so a bare `forEach n in ns { … }` would lose
 * it: the sentence offers to keep it, and a reader who does not want it may take
 * the `let xs` out of the middle.
 *
 * The head is shared with VN5010, which says it at parse time about a lambda
 * body that is a statement rather than a value. Neither can reach the other's
 * input: that one needs the parse to have failed and this one needs it to have
 * succeeded, so the two illustrations differ without ever meeting.
 */
const IN_A_STATEMENT =
  "A verb needs a statement of its own. To keep what it answers, write `let xs = []` and then `forEach n in ns { xs = xs.push(…) }`.";

/**
 * Why a `fn` cannot call this, in the one sentence the language uses for it.
 *
 * One sentence with one owner, because the same mistake is reached two ways: the
 * checker reads it off the AST, and the compiler raises it from here for a body
 * it is asked to compile anyway. A verb belongs where the world can be reached,
 * and a pure body is the one place it cannot be.
 *
 * The head is invariant and the way out is not, so the node decides the way out
 * rather than the caller. Two callers deciding separately is two explanations of
 * one program, and at most one of them is the one the reader can act on.
 *
 * @param called The verb as it was written, dotted path and all.
 * @param at The node the refusal points at, whose enclosing body decides which
 * way out a reader can take.
 * @returns The line to report, in the reader's terms.
 */
export function pureBodyCannotCall(called: string, at: AstNode): string {
  return `A \`fn\` is pure, so it cannot call \`${called}\`. ${wayOutFrom(at)}`;
}

/**
 * The way out the body around this node can actually take.
 *
 * The nearest body decides, which is what makes the inner one of
 * `fn f(ns) => ns.map(n => …)` the deciding body: a reader takes the way out of
 * the body they are standing in, not of an outer one they happen to be inside.
 */
function wayOutFrom(at: AstNode): string {
  for (let node: AstNode | undefined = at.$container; node; node = node.$container) {
    if (isFnExpr(node)) return inTheMiddleOfACall(node) ? IN_A_STATEMENT : IN_A_FRAGMENT;
    if (isFnDecl(node)) return IN_A_FRAGMENT;
  }
  return IN_A_FRAGMENT;
}

/**
 * Whether this lambda is an argument of a call, so it has no name of its own.
 *
 * `let f = fn () { … }` and `fn f() { … }` both name a body, and a name is what
 * both halves of the other way out need: a `fragment` is declared under one, and
 * a call is lifted by leaving one behind. `rows.map(fn (n) => …)` has neither, so
 * a body written there is told about the loop instead.
 */
function inTheMiddleOfACall(lambda: FnExpr): boolean {
  return isArg(lambda.$container) || isActionCall(lambda.$container);
}

/**
 * A `let` whose trailing arguments make it a call, in a body that cannot make
 * one.
 *
 * The checker refuses this where it is written, in the same sentence. This is
 * what stops the compiler carrying on regardless: it compiled only the value, so
 * `let said = io.print "..."` bound the callee, ran nothing, and reported
 * success.
 *
 * A bound `fail` is not one of these. It is the verb a pure body may run, so the
 * caller compiles the raise rather than asking here.
 *
 * @param stmt The binding, for the span the refusal points at.
 * @throws ProblemError `VN2024` when the binding carries arguments or options for
 * any verb but `fail`.
 */
export function refuseACall(stmt: LetStmt): void {
  if (stmt.args.length === 0 && !stmt.opts) return;
  const called = dottedPath(stmt.value) ?? "a verb";
  if (called === RAISES) return;
  refuse(stmt, called);
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
      title: pureBodyCannotCall(called, node),
    }),
  );
}
