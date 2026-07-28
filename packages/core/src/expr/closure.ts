import type { CompiledBody } from "../compile/compile.types.js";
import { hasCells } from "./cell.types.js";
import { CLOSURE, type Closure } from "./closure.types.js";
import type { EvalEnv } from "./eval-env.types.js";

/** Whether this value is a `fn`. The brand distinguishes it from a lookalike map. */
export function isClosure(value: unknown): value is Closure {
  return typeof value === "object" && value !== null && CLOSURE in value;
}

/**
 * Build a function value from parts the compiler already prepared.
 *
 * The free names are addressed here, once, against the environment the function
 * is being defined in, so the body reads them by index rather than walking the
 * chain on every call. Only where that environment hands out cells: a function
 * nested in another reads its parent's frame, which has slots and no cells, and
 * there the body falls back to asking by name.
 */
export function makeClosure(params: readonly string[], body: CompiledBody, env: EvalEnv): Closure {
  if (body.free.length === 0 || !hasCells(env)) return { [CLOSURE]: true, params, body, env };
  const up = body.free.map((name) => env.cell(name));
  return { [CLOSURE]: true, params, body, env, up };
}

/**
 * A class, not an object literal holding a closure: one shared prototype method
 * means the `lookup` call site inside the evaluator sees a single callee.
 *
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so a Venn binding
 * named `constructor` or `toString` would resolve to JavaScript's own.
 */
class ChildEnv implements EvalEnv {
  constructor(
    private readonly parent: EvalEnv,
    private readonly bindings: Record<string, unknown>,
  ) {}

  lookup(name: string): unknown {
    if (Object.hasOwn(this.bindings, name)) return this.bindings[name];
    return this.parent.lookup(name);
  }
}

/**
 * An environment nested in `parent`, holding the given bindings.
 *
 * Only own properties of `bindings` count as bound, so a name such as
 * `toString` resolves through to the parent rather than to JavaScript's own.
 */
export function childEnv(parent: EvalEnv, bindings: Record<string, unknown>): EvalEnv {
  return new ChildEnv(parent, bindings);
}
