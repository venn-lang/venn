import type { Expr } from "../generated/ast.js";

/**
 * A member read, however the source spelled it: `m.name` or `m["name"]`.
 *
 * Both are the same question, and until the two were held together the bracket
 * spelling asked nobody: `const t: number = m["name"]` passed check while
 * `const t: number = m.name` was VN3010, so the way out of a type error was to
 * change a dot into a bracket.
 */
export interface MemberRead {
  /** Where to report, and what a hover reads the type off. */
  node: Expr;
  /** The member's name, worked out by the caller. */
  name: string;
  /**
   * Whether the source asked rather than told. `?.` asks whether something is
   * there, so "no" is an answer rather than a mistake; a bracket has no way to
   * ask, so it always tells.
   */
  asking: boolean;
  /**
   * How the read is written after the receiver, where writing the name after a
   * dot would not compile: a position is `[0]`, and `.0` is not Venn. Set only
   * for a read by position, and preferred over `name` by everything that prints
   * a sentence about the read.
   */
  spelled?: string;
}
