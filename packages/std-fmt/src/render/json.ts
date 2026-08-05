import { isLeafValue } from "@venn-lang/sdk";
import type { Show } from "./render.types.js";

/**
 * Renders a value as JSON text.
 *
 * A value the language writes as one word is written that way, as the string
 * `"250ms"` or `"regex(r\"a-z\", \"i\")"`, not as the envelope it happens to be
 * held in. The bare base number `250` was the other candidate for a unit and
 * loses what the number counts: `1kb` and `50%` would become `1024` and `0.5`
 * with nothing left to say bytes or a proportion. `"250ms"` says it, and
 * `Duration` reads it straight back, so the round trip closes. A regex and a
 * task have no envelope worth writing at all: their `compiled` and `promise`
 * are a `RegExp` and a `Promise`, which serialise to `{}`.
 *
 * A value JSON cannot express (a cycle, a BigInt) falls back to `String(value)`
 * instead of throwing: formatting is not where a run should die.
 *
 * @param value What to render.
 * @param show The language's writer for a single value.
 * @param spaces Spaces per level of nesting. 0 puts it all on one line.
 * @returns The JSON text.
 */
export function toJson(value: unknown, show: Show, spaces = 2): string {
  const written = (_key: string, held: unknown): unknown => (isLeafValue(held) ? show(held) : held);
  try {
    return JSON.stringify(value, written, spaces) ?? String(value);
  } catch {
    return String(value);
  }
}
