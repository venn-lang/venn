import type { CompiledBody } from "../compile/compile.types.js";
import type { Cell } from "./cell.types.js";
import type { EvalEnv } from "./eval-env.types.js";

/** The brand that tells a function value apart from a map that happens to look like one. */
export const CLOSURE: unique symbol = Symbol("venn.closure");

/**
 * A function value: its parameter names, its compiled body, and the environment
 * it was defined in.
 *
 * Because `fn` is pure (§08), a closure runs entirely in the evaluator, which
 * is what makes functions first-class and callable from any expression,
 * interpolation included.
 *
 * The body arrives already compiled. A `fn (…) => …` written inside `map` is
 * evaluated once per call to `map`, so compiling there would put the compiler
 * back in the hot loop.
 */
export interface Closure {
  readonly [CLOSURE]: true;
  readonly params: readonly string[];
  readonly body: CompiledBody;
  readonly env: EvalEnv;
  /**
   * A cell per free name of the body, resolved when this value was made.
   *
   * Absent for a body with no free names. An entry is absent for the one name
   * that cannot be resolved where the `fn` is written: a name the body around
   * it binds further down, which is asked for by name at call time instead.
   */
  readonly up?: readonly (Cell | undefined)[];
}

/** A function value whose free names are already resolved. */
export interface ClosureParts {
  readonly params: readonly string[];
  readonly body: CompiledBody;
  readonly env: EvalEnv;
  readonly up: readonly (Cell | undefined)[];
}
