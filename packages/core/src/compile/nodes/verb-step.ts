import { failError } from "../../fail/index.js";
import type { ActionCall, Expr } from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { spanOf } from "../../span/index.js";
import type { Step } from "../compile.types.js";
import type { LexScope } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";
import { refuseTheVerb } from "./pure-body.js";

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
  if (call.target !== "fail") refuseTheVerb(call);
  const said = messageOf(call);
  const message = said ? compile(said, scope) : undefined;
  // The same span the checker would point at: the `fail` itself, not the body
  // around it, so `e.where` names the line that refused.
  const where = spanOf(call, fileOf(call));
  const opts = call.opts ? compile(call.opts, scope) : undefined;
  return (frame) => {
    const written = (opts?.(frame) ?? {}) as Record<string, unknown>;
    throw failError({ message: String(message?.(frame) ?? ""), opts: written, where });
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
