import type { CellEnv } from "@venn-lang/core";

/**
 * A lexical scope: the evaluator's env plus mutation and nesting.
 *
 * A `CellEnv`, so a closure defined here can address its free names once and
 * read them by index afterwards instead of walking the chain per call.
 */
export interface Scope extends CellEnv {
  set(name: string, value: unknown): void;
  child(): Scope;
  /**
   * The scope at the top of the chain, which is the file's own.
   *
   * What a fragment reads: it is written in a file and belongs to it, wherever
   * it is called from, so it takes the file rather than the caller.
   */
  root(): Scope;
}
