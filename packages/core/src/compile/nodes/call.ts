import { invoke, invoke1 } from "../../expr/invoke.js";
import { isWaiting, whenAllReady, whenBothReady } from "../../expr/pending.js";
import type { Call } from "../../generated/ast.js";
import type { Compile, Thunk } from "../compile.types.js";

/**
 * A call, with its argument list compiled.
 *
 * A call is the hottest thing a program does, so the common arities get their
 * own thunk and build the argument array from a literal rather than with `map`.
 */
export function compileCall(expr: Call, compile: Compile): Thunk {
  const callee = compile(expr.callee);
  const args = (expr.args?.args ?? []).map((arg) => compile(arg.value));
  if (args.length === 0) return (env) => call(callee(env), []);
  if (args.length === 1) return oneArg(callee, args[0] as Thunk);
  if (args.length === 2) return twoArgs(callee, args[0] as Thunk, args[1] as Thunk);
  return (env) =>
    call(
      callee(env),
      args.map((arg) => arg(env)),
    );
}

function oneArg(callee: Thunk, first: Thunk): Thunk {
  return (env) => {
    const fn = callee(env);
    const arg = first(env);
    // The overwhelmingly common shape: nothing is waiting, so the value goes
    // straight in, with no list built to hold one thing.
    if (!isWaiting(fn) && !isWaiting(arg)) return invoke1(fn, arg);
    return call(fn, [arg]);
  };
}

function twoArgs(callee: Thunk, first: Thunk, second: Thunk): Thunk {
  return (env) => {
    const fn = callee(env);
    const a = first(env);
    const b = second(env);
    if (!isWaiting(fn) && !isWaiting(a) && !isWaiting(b)) return invoke(fn, [a, b]);
    return call(fn, [a, b]);
  };
}

/** Wait for whatever is not here yet: the function, or what it is given. */
function call(callee: unknown, values: unknown[]): unknown {
  if (!isWaiting(callee)) return whenAllReady(values, (ready) => invoke(callee, ready));
  return whenBothReady(callee, Promise.all(values), (fn, ready) => invoke(fn, ready as unknown[]));
}
