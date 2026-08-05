import { isDuration } from "./unit-guards.js";

/**
 * How many milliseconds a value can be used as, or nothing when it cannot.
 *
 * A plain number is read as milliseconds, so `{ timeout: 50 }` and
 * `{ timeout: 50ms }` mean the same thing. Everything else answers nothing,
 * because there were five copies of this and four different answers to "what
 * is this if it is not a length of time": `NaN`, `0`, `undefined` and
 * `undefined ?? 0`. Zero was the worst of them, since a bound nobody honoured
 * then looked exactly like a bound of zero. What to do with nothing is the
 * caller's to decide and to say out loud, which is why this will not decide it.
 *
 * This is acceptance, not recognition, and the two differ on exactly one point.
 * {@link isDuration} says what a value IS, and `1s / 0` is a duration whose ms
 * is `Infinity`: it prints as `Infinityms` because it is still a length of time
 * gone wrong, not a map. This says what a value can be USED as, and nothing
 * sensible comes of handing `NaN` to a timer, so a non-finite ms is refused one
 * step before it becomes a `setTimeout`. Do not make either of them the other.
 *
 * @param value Any evaluated value: a number, a `10s` literal, or neither.
 * @returns The milliseconds, or `undefined` when the value is not a length of
 * time or is one no clock can honour.
 */
export function durationMs(value: unknown): number | undefined {
  const ms = typeof value === "number" ? value : isDuration(value) ? value.ms : undefined;
  return ms !== undefined && Number.isFinite(ms) ? ms : undefined;
}
