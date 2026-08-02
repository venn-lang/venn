import type { Type } from "./type.types.js";

/**
 * Where the `return`s of one body report what they hand back.
 *
 * A `return` is inferred in the scope it is written in, which is the only scope
 * that knows what the `if` around it narrowed. Reading it again afterwards from
 * the body's own scope loses that, so what it found is written down here instead
 * and the body collects it once every statement has been walked.
 */
export interface ReturnSink {
  /** What the `fn` declared it hands back, when it declared anything. */
  readonly wanted?: Type;
  /** What each `return` in the body turned out to give, in written order. */
  readonly found: Type[];
}
