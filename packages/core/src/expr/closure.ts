import type { CompiledBody } from "../compile/compile.types.js";
import { hasCells } from "./cell.types.js";
import { CLOSURE, type Closure, type ClosureParts } from "./closure.types.js";
import type { EvalEnv } from "./eval-env.types.js";

/** Whether this value is a `fn`. The brand distinguishes it from a lookalike map. */
export function isClosure(value: unknown): value is Closure {
  return typeof value === "object" && value !== null && CLOSURE in value;
}

/**
 * Build a function value, addressing its free names against the environment it
 * is being defined in.
 *
 * For a `fn` written where bindings are cells: at the top of a file, in a
 * fragment, in a scheduler scope. A `fn` written inside a compiled body knows
 * where its free names live before it is ever made, and arrives here through
 * {@link closureWith} carrying them.
 */
export function makeClosure(params: readonly string[], body: CompiledBody, env: EvalEnv): Closure {
  if (body.free.length === 0 || !hasCells(env)) return { [CLOSURE]: true, params, body, env };
  const up = body.free.map((name) => env.cell(name));
  return { [CLOSURE]: true, params, body, env, up };
}

/**
 * The same value, with the free names already resolved where the `fn` was
 * written.
 *
 * One place builds the shape, so every closure the language makes has the same
 * one whichever route it came by.
 *
 * @param parts The parameter names, the compiled body, the defining
 * environment, and a cell per free name.
 * @returns The function value.
 */
export function closureWith(parts: ClosureParts): Closure {
  return { [CLOSURE]: true, params: parts.params, body: parts.body, env: parts.env, up: parts.up };
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
