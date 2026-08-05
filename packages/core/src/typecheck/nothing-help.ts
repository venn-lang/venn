import { fits } from "./fits.js";
import { withoutNothing } from "./nothing.js";
import type { Type } from "./type.types.js";

/**
 * The two ordinary answers to a value that may be nothing, as one line.
 *
 * One place, because two of them drift and this one is now reached from two
 * failures: a nullable handed where the plain type was asked for, and a member
 * read through the nullable without asking first. Both spellings in it are run
 * by `a-read-past-the-end.test.ts`, since a help line naming a spelling the
 * language does not have is worse than no help line at all.
 */
export const PAST_THE_NOTHING =
  "It may be nothing. Give it a stand-in with `?? …`, or ask `if x != null` first.";

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
  return PAST_THE_NOTHING;
}
