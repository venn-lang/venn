import type { ArgSpec } from "@venn-lang/sdk";
import type { TypeSpec } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";

/**
 * One `data.faker.*` verb: what it is called, what it means, and how to draw a
 * value. A spec is plain data, so the action wiring reads the list as it stands
 * and needs no edit when a category grows.
 */
export interface FakerSpec {
  /** The verb, without the namespace: `email`, `br.cpf`. */
  name: string;
  /** One line, in the user's domain. Shown on hover and in completion. */
  doc: string;
  /** The type it draws. A `TypeSpec`, not a name, so the checker can act on it. */
  result: TypeSpec;
  /**
   * The positional arguments `make` reads, in order. Most verbs read none and
   * leave this out. The action wiring turns it into the signature the checker sees.
   */
  args?: readonly ArgSpec[];
  /** Draw a value. `args` carries the call's positional arguments, if any. */
  make(rng: Rng, args: readonly unknown[]): unknown;
}
