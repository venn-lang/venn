import { childEnv } from "../../expr/closure.js";
import type { EvalEnv } from "../../expr/eval-env.types.js";
import type { Frame } from "../../expr/frame.js";
import { writeSlot } from "../../expr/frame.js";
import { isWaiting } from "../../expr/pending.js";
import type { TryExpr } from "../../generated/ast.js";
import { caughtValue, isFailure } from "../../problem/index.js";
import type { Thunk } from "../compile.types.js";
import type { LexScope } from "../lex-scope.js";
import type { CompileIn } from "./fn.js";

/**
 * `try expr else fallback`, and `try expr catch e => fallback`.
 *
 * The statement form recovers where steps run and cannot hand a value out, so
 * the shape a program actually wants, "try this, and if it fails use that",
 * could not be written where the value was needed.
 *
 * What is caught is a failure. A control signal is not one: a `return` from
 * inside the attempt is the function leaving, not the attempt failing, and
 * swallowing it here would turn a `return` into a fallback.
 */
export function compileTry(expr: TryExpr, scope: LexScope, compileIn: CompileIn): Thunk {
  const attempt = compileIn(expr.attempt, scope);
  const fallback = compileIn(expr.fallback, scope);
  // -1 outside a function body, where there is no frame to write the name into.
  const slot = expr.error ? scope.names.indexOf(expr.error) : -1;
  const name = expr.error;
  return (env) => {
    try {
      const value = attempt(env);
      return isWaiting(value) ? value.catch((failure) => recover(failure, env)) : value;
    } catch (failure) {
      return recover(failure, env);
    }
  };

  function recover(failure: unknown, env: EvalEnv): unknown {
    if (!isFailure(failure)) throw failure;
    return fallback(name ? bound(env, failure) : env);
  }

  /**
   * Inside a function the name has a slot, like any other local, so the
   * fallback goes on reading its frame. Anywhere else there is no frame and the
   * fallback reads names by asking, so the failure is handed over in a scope of
   * its own.
   */
  function bound(env: EvalEnv, failure: unknown): EvalEnv {
    const value = caughtValue(failure);
    if (slot === -1) return childEnv(env, { [name as string]: value });
    writeSlot(env as Frame, slot, value);
    return env;
  }
}
