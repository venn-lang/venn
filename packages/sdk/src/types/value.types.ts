import type { TypeSpec } from "@venn-lang/types";

/**
 * A constant a plugin publishes: `math.pi`, read as the number it is.
 *
 * Data rather than something to call, so it needs no arguments, no context and
 * no run: the value is the whole of it, and the type is what the checker and the
 * editor read.
 */
export interface ValueDefinition {
  readonly name: string;
  /** One line, in the reader's terms. Shown by the editor where the name is. */
  readonly doc: string;
  readonly type: TypeSpec;
  readonly value: unknown;
}
