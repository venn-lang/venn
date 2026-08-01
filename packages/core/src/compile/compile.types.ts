import type { EvalEnv } from "../expr/eval-env.types.js";
import type { Frame } from "../expr/frame.js";
import type { Expr } from "../generated/ast.js";

/**
 * A compiled expression: everything the source decided is already captured, so
 * running it needs only the environment.
 */
export type Thunk = (env: EvalEnv) => unknown;

/**
 * Compile a sub-expression.
 *
 * Passed into each node's compiler rather than imported, so a compiler for one
 * kind of node never depends on the dispatcher that reaches it.
 */
export type Compile = (expr: Expr) => Thunk;

/**
 * One statement of a body, compiled.
 *
 * Answers whether the body has left, and how: a number rather than a thrown
 * signal, because a `break` in a loop of fifty thousand would otherwise build
 * fifty thousand stack traces.
 */
export type Step = (frame: Frame) => number;

/** A function body, compiled: its local bindings in order, then its result. */
export interface CompiledBody {
  /** Every name that gets a slot: the parameters first, then the locals. */
  readonly names: readonly string[];
  /** How many names spill past the frame's inline slots. Usually none. */
  readonly extra: number;
  /** Every name the body reads but does not bind, in cell order. */
  readonly free: readonly string[];
  /**
   * The body binds one name, reads nothing else, and asks for nothing by text,
   * so a call hands the argument straight to `result` with no frame between.
   */
  readonly bare: boolean;
  readonly locals: readonly CompiledLocal[];
  /**
   * The statements after the leading run of bindings, when there are any.
   *
   * Absent for a body that is bindings and a value, which is every body written
   * before a body could hold a statement, so those keep the path they had.
   */
  readonly steps?: readonly Step[];
  /** Absent for a body whose statements all leave: `fn f() { return 1 }`. */
  readonly result?: Thunk;
}

/** One of the body's `let` bindings, compiled. Filled in declaration order. */
export interface CompiledLocal {
  /** Which slot of the frame this local writes to. */
  readonly slot: number;
  readonly value: Thunk;
}
