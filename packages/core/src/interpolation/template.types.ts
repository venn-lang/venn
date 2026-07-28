import type { Expr } from "../generated/ast.js";

/** One `${…}`, resolved from text to something the evaluator can just run. */
export interface TemplateHole {
  /** The placeholder's source, kept for the error when it does not parse. */
  readonly source: string;
  /** The parsed expression, or undefined when the source is not one. */
  readonly expr: Expr | undefined;
}

/**
 * A string literal split once into the text around its placeholders and what
 * fills them. `chunks` has exactly one more entry than `holes`: `chunks[i]`
 * comes before `holes[i]`, and the last chunk is the tail.
 */
export interface Template {
  readonly chunks: readonly string[];
  readonly holes: readonly TemplateHole[];
}
