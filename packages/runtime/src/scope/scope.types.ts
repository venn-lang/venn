import type { CellEnv } from "@venn/core";

/**
 * A lexical scope: the evaluator's env plus mutation and nesting.
 *
 * A `CellEnv`, so a closure defined here can address its free names once and
 * read them by index afterwards instead of walking the chain per call.
 */
export interface Scope extends CellEnv {
  set(name: string, value: unknown): void;
  child(): Scope;
}
