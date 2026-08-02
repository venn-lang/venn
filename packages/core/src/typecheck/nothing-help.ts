import { fits } from "./fits.js";
import { withoutNothing } from "./nothing.js";
import type { Type } from "./type.types.js";

/**
 * The way out, when what was found is what was wanted and nothing besides.
 *
 * `expected string, found string | null` is true and leaves the reader to work
 * out that the fault is the nothing, and that there are two ordinary answers to
 * it. This says which, and only where that is what happened: a `number` where a
 * `string` was wanted is a different mistake with different answers.
 *
 * @returns The line to put under the mismatch, or nothing when the nothing is
 * not what went wrong.
 */
export function helpAboutNothing(actual: Type, expected: Type): string | undefined {
  const rest = withoutNothing(actual);
  if (!rest || !fits(rest, expected)) return undefined;
  return "It may be nothing. Give it a stand-in with `?? …`, or ask `if x != null` first.";
}
