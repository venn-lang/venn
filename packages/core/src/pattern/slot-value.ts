import type { PatternSlot, Rest } from "./pattern-slots.js";
import { readPath } from "./read-path.js";

/**
 * What one name of a pattern gets from the value being taken apart.
 *
 * Nearly always one value at the end of a path. A name that takes the rest gets
 * what the pattern did not name: the other fields as a map of their own, or the
 * items after the last one that was named.
 *
 * @param value What is being taken apart.
 * @param slot One of the names {@link patternSlots} read off the pattern.
 * @returns The value for that name, or null where the way down runs out.
 */
export function slotValue(value: unknown, slot: PatternSlot): unknown {
  const held = readPath(value, slot.path);
  return slot.rest ? leftOver(held, slot.rest) : held;
}

function leftOver(held: unknown, rest: Rest): unknown {
  if (rest.of === "list") return Array.isArray(held) ? held.slice(rest.from) : [];
  return without(held, rest.without);
}

/** The map minus the keys the pattern named, and a fresh one either way. */
function without(held: unknown, named: readonly string[]): Record<string, unknown> {
  const left: Record<string, unknown> = {};
  if (held === null || typeof held !== "object" || Array.isArray(held)) return left;
  for (const [key, value] of Object.entries(held)) {
    if (!named.includes(key)) left[key] = value;
  }
  return left;
}
