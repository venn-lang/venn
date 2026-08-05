import { invoke, invoke1 } from "../../expr/invoke.js";
import { isWaiting, whenAllReady, whenBothReady } from "../../expr/pending.js";
import type { Call } from "../../generated/ast.js";
import type { Compile, Thunk } from "../compile.types.js";

/**
 * A call, with its argument list compiled.
 *
 * A call is the hottest thing a program does, so the common arities get their
 * own thunk and build the argument array from a literal rather than with `map`.
 *
 * Every one of them hands `invoke` the node as well, because a call is where a
 * refusal from below the language enters the program: `json.parse` raises
 * inside the verb, which knows the text it could not read and nothing at all
 * about the file that asked. The node is captured while compiling, so it costs
 * one word in the closure and nothing per call, and `invoke` reads it only on
 * the branch that is not a `fn`. Wrapping the call here instead measured 12%
 * on `fib(25)`: a function holding a handler is not inlined into its caller.
 */
export function compileCall(expr: Call, compile: Compile): Thunk {
  const callee = compile(expr.callee);
  const args = (expr.args?.args ?? []).map((arg) => compile(arg.value));
  if (args.length === 0) return (env) => call(callee(env), [], expr);
  if (args.length === 1) return oneArg(callee, args[0] as Thunk, expr);
  if (args.length === 2)
    return twoArgs({ callee, first: args[0] as Thunk, second: args[1] as Thunk, at: expr });
  return (env) =>
    call(
      callee(env),
      args.map((arg) => arg(env)),
      expr,
    );
}

function oneArg(callee: Thunk, first: Thunk, at: Call): Thunk {
  return (env) => {
    const fn = callee(env);
    const arg = first(env);
    // The overwhelmingly common shape: nothing is waiting, so the value goes
    // straight in, with no list built to hold one thing.
    if (!isWaiting(fn) && !isWaiting(arg)) return invoke1(fn, arg, at);
    return call(fn, [arg], at);
  };
}

function twoArgs(args: { callee: Thunk; first: Thunk; second: Thunk; at: Call }): Thunk {
  return (env) => {
    const fn = args.callee(env);
    const a = args.first(env);
    const b = args.second(env);
    if (!isWaiting(fn) && !isWaiting(a) && !isWaiting(b)) return invoke(fn, [a, b], args.at);
    return call(fn, [a, b], args.at);
  };
}

/** Wait for whatever is not here yet: the function, or what it is given. */
function call(callee: unknown, values: unknown[], at: Call): unknown {
  if (!isWaiting(callee)) return whenAllReady(values, (ready) => invoke(callee, ready, at));
  return whenBothReady(callee, Promise.all(values), (fn, ready) =>
    invoke(fn, ready as unknown[], at),
  );
}
