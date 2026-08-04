/**
 * `10s` as milliseconds.
 *
 * A plain number is read as milliseconds too, so `{ timeout: 50 }` and
 * `{ timeout: 50ms }` mean the same thing. Anything else is not a length of
 * time, and answering zero for it is how a bound nobody honoured came to look
 * like a bound.
 */
export function durationMs(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  const duration = value as { kind?: string; ms?: number };
  return duration?.kind === "duration" ? duration.ms : undefined;
}
