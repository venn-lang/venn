import { memberValue } from "../expr/member-value.js";
import type { Step } from "./pattern-slots.js";

/**
 * Follow a pattern's steps into a value.
 *
 * The same reading `order.total` and `pair[0]` do, since a pattern is those
 * spelled shorter: a field the value does not carry is `null` here as it is
 * there, and the checker is what says so before anything runs.
 *
 * @param value What is being taken apart.
 * @param path Field names and list positions, from the outside in.
 * @returns What that path holds, or null when the way down runs out.
 */
export function readPath(value: unknown, path: readonly Step[]): unknown {
  let held = value;
  for (const step of path) {
    if (held === null || held === undefined) return null;
    held = typeof step === "number" ? item(held, step) : memberValue(held, step);
  }
  return held ?? null;
}

function item(value: unknown, at: number): unknown {
  return Array.isArray(value) ? value[at] : undefined;
}
