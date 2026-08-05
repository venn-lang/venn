import type { Span } from "../problem/index.js";

/**
 * A name a closure reads before the binding below it exists.
 *
 * The name and the place, and nothing else: the refusal is raised twice, once by
 * the checker and once by the compiler, and both say the same sentence about the
 * same span.
 */
export interface ForwardRead {
  /** The name the closure read. */
  readonly name: string;
  /** Where the read is written, which is what the refusal points at. */
  readonly span: Span;
}
