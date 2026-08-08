import type { EvalEnv } from "../expr/eval-env.types.js";
import type { Frame } from "../expr/frame.js";
import type { Cell } from "../expr/index.js";
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
 *
 * A promise of that number is the same answer, arriving later. A statement that
 * reached the world hands one back, and the walker chains the statements behind
 * it onto it, so a body runs in the order it is written whether or not anything
 * in it is slow. Nothing pays for this until a statement is actually slow: the
 * check is one `instanceof` past the path an ordinary statement takes.
 */
export type Step = (frame: Frame) => number | Promise<number>;

/**
 * Where one free name of a closure lives, worked out where the closure is
 * written and answered when it is made.
 *
 * `undefined` for the one name a closure cannot be told about at that point: the
 * name of the `let` the closure is the value of, which is still asked for by
 * name because the cell it will hold does not exist yet.
 */
export type Capture = (env: EvalEnv) => Cell | undefined;

/** A function body, compiled: its local bindings in order, then its result. */
export interface CompiledBody {
  /** Every name that gets a slot: the parameters first, then the locals. */
  readonly names: readonly string[];
  /** How many names spill past the frame's inline slots. Usually none. */
  readonly extra: number;
  /** Every name the body reads but does not bind, in cell order. */
  readonly free: readonly string[];
  /**
   * The slots holding a cell rather than the value, because a closure written
   * in the body captured them. Absent for the bodies that capture nothing,
   * which is most of them.
   */
  readonly boxed?: ReadonlySet<number>;
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
  /**
   * How a captured binding holds what it was given, absent when nothing
   * captured it and the value goes into the slot as it is.
   *
   * Held apart from {@link value} because a binding whose value has not arrived
   * is settled before it is boxed: a closure that captured the name must find
   * what was bound in the cell, not the wait for it. The names a pattern reads
   * out of a whole need none of this and carry none: they are read after the
   * whole has landed, so they are never themselves still arriving.
   */
  readonly box?: (value: unknown) => unknown;
}
