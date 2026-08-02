import { isNothing, withoutNothing } from "./nothing.js";
import type { Type } from "./type.types.js";
import { DYNAMIC, union } from "./type.types.js";
import { prune, unify } from "./unify.js";

/**
 * What `&&`, `||` and `??` are worth.
 *
 * All three hand back an operand rather than a verdict, so none of them is a
 * `bool`: `user.name || "anon"` is a string, and typing it as a boolean refused
 * a line that runs and answers correctly.
 *
 * `??` and `||` also take something away. A left side that is nothing is
 * exactly the case where they hand over the right, so nothing cannot come out
 * of either, and saying it still might is what made `??` look like it changed
 * no type at all. `&&` is the other way round: the falsy left *is* what it
 * gives back, so its type keeps everything.
 *
 * @param op One of `&&`, `||`, `??`.
 * @param left The type of the left side.
 * @param right The type of the right side.
 * @returns The type of the whole expression.
 */
export function logicalType(op: string, left: Type, right: Type): Type {
  if (op === "&&") return either(left, right);
  const settled = prune(left);
  // Anything at all could be nothing, so nothing is what can be said.
  if (settled.kind === "dynamic" || settled.kind === "var") return DYNAMIC;
  return whenNothing(settled, right);
}

/** `??` and `||`: the left without the nothing it may be, or the right. */
function whenNothing(left: Type, right: Type): Type {
  if (isNothing(left)) return right;
  const kept = withoutNothing(left);
  // Nothing was taken away, so the left is the whole answer: the right is a
  // fallback for a case that cannot happen.
  return kept ? either(kept, right) : left;
}

/**
 * One of two, as one type. Two sides that agree are that type rather than a
 * union of a thing with itself, which is what every message would read as.
 */
export function either(left: Type, right: Type): Type {
  return unify(left, right) ? left : union([left, right]);
}
