/**
 * Reading an argument that has to be a count, a size, a width or a position.
 *
 * Coercing a value into one of these positions collapses `-1`, `1.5`, `NaN` and
 * a missing argument onto `0`. Four different mistakes, one answer, and the
 * answer is an empty list that reads as "no results" rather than as "you asked
 * wrongly". One reader for all of them instead, and it refuses.
 */

import { notACount, notANumber, notAPosition } from "./argument-refusal.js";
import type { Counted } from "./counted-argument.types.js";

/**
 * The whole number a builtin was handed, or a refusal.
 *
 * @param value Whatever arrived in the position.
 * @param at The verb, the position and the range it accepts.
 * @returns The number, known whole and inside the range.
 * @throws {ProblemError} `VN3016` when it is not a number, `VN3031` when it is
 * a number this position cannot use.
 */
export function counted(value: unknown, at: Counted): number {
  if (typeof value !== "number") throw notANumber(value, at);
  if (!Number.isInteger(value) || outside(value, at)) throw notACount(value, at);
  return value;
}

/** Past whichever ends the position has, and there may be none, one or two. */
function outside(value: number, at: Counted): boolean {
  if (at.least !== undefined && value < at.least) return true;
  return at.most !== undefined && value > at.most;
}

/**
 * A plain number in an argument position, whole or not.
 *
 * For the positions where a fraction is meaningful: a clamp bound, an exponent.
 * `NaN` and the infinities are still refused, because a bound that is not a
 * number bounds nothing and the old answer was to quietly honour neither.
 *
 * @param value Whatever arrived in the position.
 * @param at The verb and the position, for the sentence.
 * @returns The number, known finite.
 * @throws {ProblemError} `VN3016` when it is not a number, `VN3031` when it is
 * `NaN` or an infinity.
 */
export function numeric(value: unknown, at: Counted): number {
  if (typeof value !== "number") throw notANumber(value, at);
  if (!Number.isFinite(value)) throw notACount(value, at);
  return value;
}

/**
 * The same, with a stand-in for a position nobody wrote in.
 *
 * Only for the arguments a signature marks optional. `null` is not absence
 * here: a program that worked out `null` and handed it over has the mistake
 * this module exists to report, and taking the default would hide it.
 *
 * @param value Whatever arrived, or `undefined` when the call was short.
 * @param fallback What the position means when it is left out.
 * @param at The verb, the position and the range it accepts.
 * @returns The number, known whole and inside the range.
 * @throws {ProblemError} `VN3016` or `VN3031`, as {@link counted} does.
 */
export function countedOr(value: unknown, fallback: number, at: Counted): number {
  return value === undefined ? fallback : counted(value, at);
}

/**
 * A position in a list or a string: whole, and never before the start.
 *
 * Past the end stays `null`, because a read past the end is absence and the
 * checker types it as such. Before the start is not absence: there is no
 * position `-1` in any list, so `xs[i - 1]` with `i` at zero is an off-by-one
 * that used to read as "nothing there".
 *
 * @param value The index, already known to be a number.
 * @returns The index, known whole and at or after zero.
 * @throws {ProblemError} `VN3031` when it is not a position at all.
 */
export function position(value: number): number {
  if (Number.isInteger(value) && value >= 0) return value;
  throw notAPosition(value);
}
