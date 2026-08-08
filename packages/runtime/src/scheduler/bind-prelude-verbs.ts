import { nativeFn } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { preludeVerb } from "./run-action.js";

/**
 * Put the prelude's verbs in the root scope, as values.
 *
 * `print x` at the top level of a file is dispatched by the scheduler, which
 * holds the engine those verbs need. A body compiled by `core` holds no engine
 * and never will: `EvalEnv` is a lookup and nothing else, deliberately, so the
 * evaluator stays free of protocol execution.
 *
 * A value in scope is how the engine already crosses that line. `io.print` works
 * inside a `fn` because the namespace `io` is an object the runtime built with
 * the engine captured, and the compiled body only ever looked a name up. The
 * verbs written without a namespace get the same treatment here, which is why a
 * compiled body needed no new machinery to reach them.
 *
 * `fail` is not among them. Raising is control flow rather than an effect, the
 * compiler builds it into the body directly, and a value that never returns is
 * not something a caller can hold.
 */
export function bindPreludeVerbs(args: { engine: Engine; scope: Scope }): void {
  for (const name of ["print", "log", "wait", "skip", "exit"]) {
    args.scope.set(
      name,
      nativeFn((values) => preludeVerb({ engine: args.engine, name, args: values })),
    );
  }
}
