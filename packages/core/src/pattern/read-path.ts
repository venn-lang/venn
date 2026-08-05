import { indexValue, memberValue } from "../expr/member-value.js";
import type { Step } from "./pattern-slots.js";

/**
 * Follow a pattern's steps into a value.
 *
 * The same reading `order.total` and `pair[0]` do, through the same two
 * functions, since a pattern is those spelled shorter: a field the value does
 * not carry is `null` here as it is there, and the checker is what says so
 * before anything runs. A numeric step used to be its own `Array.isArray` line
 * that answered `undefined`, which the `?? null` at the bottom then laundered
 * into the right answer by accident.
 *
 * @param value What is being taken apart.
 * @param path Field names and list positions, from the outside in.
 * @returns What that path holds, or null when the way down runs out.
 */
export function readPath(value: unknown, path: readonly Step[]): unknown {
  let held: unknown = value ?? null;
  for (const step of path) {
    if (held === null) return null;
    held = typeof step === "number" ? indexValue(held, step) : memberValue(held, step);
  }
  return held;
}
