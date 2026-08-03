import type { Expr, MapLit } from "../generated/ast.js";

/** A call's arguments, told apart: what it takes, and what configures it. */
export interface SplitCall {
  args: readonly Expr[];
  opts?: MapLit;
}

/** What a call was written with, and what the verb behind it declares. */
export interface WrittenCall {
  args: readonly Expr[];
  /** How many positional arguments the verb declares. */
  takes: number;
  /**
   * The option names the verb accepts, or `true` for a schema that takes any
   * key. Absent when the caller cannot tell, and then only the count decides.
   */
  options?: readonly string[] | boolean;
}
