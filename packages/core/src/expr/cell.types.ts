import type { EvalEnv } from "./eval-env.types.js";

/**
 * A binding's storage, addressed once and read many times.
 *
 * The language has no assignment, so a name never changes what it holds, but it
 * can be *filled in* after the function reading it was built. A recursive `fn`
 * is the plain case: `fib` becomes a value before the name `fib` is bound, so
 * anything resolved eagerly would capture nothing. The cell is handed out empty
 * and filled when the binding happens, which is what lets a name be resolved at
 * compile time and still read the right value.
 */
export interface Cell {
  value: unknown;
}

/** An environment that can hand out a cell per name: the top of the chain. */
export interface CellEnv extends EvalEnv {
  cell(name: string): Cell;
}

/** Whether this environment addresses its bindings by cell. */
export function hasCells(env: EvalEnv): env is CellEnv {
  return typeof (env as CellEnv).cell === "function";
}
