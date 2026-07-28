import type { Instant } from "./unit.types.js";

/**
 * Read an ISO-8601 lexeme into an {@link Instant}, keeping the source text.
 *
 * A lexeme that does not parse takes epoch 0 rather than NaN, so comparing two
 * instants stays total. The grammar has already accepted the shape by here.
 */
export function parseInstant(iso: string): Instant {
  const epochMs = Date.parse(iso);
  return { kind: "instant", epochMs: Number.isNaN(epochMs) ? 0 : epochMs, iso };
}
