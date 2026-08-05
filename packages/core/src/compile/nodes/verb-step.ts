import type { AstNode } from "langium";
import { dottedPath } from "../../ast/index.js";
import type { EvalEnv } from "../../expr/index.js";
import { failError } from "../../fail/index.js";
import type { ActionCall, Expr, LetStmt, MapLit } from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { spanOf } from "../../span/index.js";
import type { Step, Thunk } from "../compile.types.js";
import type { LexScope } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";
import { RAISES, refuseTheVerb } from "./pure-body.js";

/**
 * A verb written as a statement of a pure body.
 *
 * `fail` is the one a `fn` may run. Raising is not an effect on the world: a
 * pure body still compiles to thunks, still touches nothing, and still answers
 * the same way for the same arguments, and "validate and refuse" is the most
 * common shape a real function has. It used to cost the author a `fragment` and
 * a `run … as` to say no to an argument.
 *
 * Every other verb reaches the world and is refused here, in the sentence the
 * checker gives it, because there is no scheduler in a compiled body to run one
 * with and compiling it to nothing is how a `print` in a `fn` printed nothing
 * and reported success.
 *
 * @param call The call, as the grammar read it.
 * @param scope The block it is written in, for the arguments it evaluates.
 * @param compile How to compile those arguments.
 * @returns A step that raises, since a `fail` never carries on.
 * @throws ProblemError `VN2024` at compile time for any verb but `fail`.
 */
export function compileVerb(call: ActionCall, scope: LexScope, compile: CompileIn): Step {
  if (call.target !== RAISES) refuseTheVerb(call);
  return raiseStep({ at: call, said: messageOf(call), opts: call.opts, scope, compile });
}

/**
 * `let stop = fail "no"`, which is a raise with a name in front of it.
 *
 * The trailing argument is what makes a `let` a call, and the checker allows
 * this one because `fail` is the verb a pure body may run. So the compiler has
 * to run it: compiling the value alone bound the callee, raised nothing, and let
 * the body carry on to answer as though the guard had passed. The binding itself
 * is never written, because a raise leaves before there is anything to write.
 *
 * @param stmt The binding, as the grammar read it.
 * @param scope The block it is written in, for the message it evaluates.
 * @param compile How to compile that message.
 * @returns The raise, or nothing when this binding is not one.
 */
export function compileBoundRaise(
  stmt: LetStmt,
  scope: LexScope,
  compile: CompileIn,
): Thunk | undefined {
  if (stmt.args.length === 0 && !stmt.opts) return undefined;
  if (dottedPath(stmt.value) !== RAISES) return undefined;
  return raiseStep({ at: stmt, said: stmt.args[0], opts: stmt.opts, scope, compile });
}

/** One raise, whether a name was written in front of it or not. */
interface Raised {
  /** The node the failure points at, and the span it reports. */
  at: AstNode;
  /** The line the reader gave it, if they gave one. */
  said: Expr | undefined;
  /** The trailing `{ code, data }`, if they wrote one. */
  opts: MapLit | undefined;
  scope: LexScope;
  compile: CompileIn;
}

/**
 * A raise never returns, and needs only the environment to build its message.
 *
 * That is why one function serves both callers: a `(env) => never` satisfies
 * `Step`, whose frame is an environment and whose `number` it never reaches,
 * and `Thunk`, which is what a `let` binds. Typing it as either one alone would
 * force a cast at the other, and a cast here would be asserting the thing the
 * signature is meant to prove.
 */
function raiseStep(raised: Readonly<Raised>): (env: EvalEnv) => never {
  const { at, said, opts, scope, compile } = raised;
  const message = said ? compile(said, scope) : undefined;
  // The same span the checker would point at: the line that refused, not the
  // body around it, so `e.where` names it.
  const where = spanOf(at, fileOf(at));
  const written = opts ? compile(opts, scope) : undefined;
  return (frame) => {
    const carried = (written?.(frame) ?? {}) as Record<string, unknown>;
    throw failError({ message: String(message?.(frame) ?? ""), opts: carried, where });
  };
}

/**
 * The line a `fail` was given, whether it was written bare or in brackets.
 *
 * Both spellings reach the scheduler as the same first argument, so both reach
 * the same failure from here. The `{ code, data }` is the trailing map in either
 * case, which is what `opts` already holds.
 */
function messageOf(call: ActionCall): Expr | undefined {
  return call.args[0] ?? call.call?.args[0]?.value;
}
