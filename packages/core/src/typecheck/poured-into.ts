/**
 * What a map is after another is poured into it.
 *
 * One reading for two spellings: `{ ...a, ...b }` and `a.merge(b)` answer the
 * same question, so they had better answer it the same way.
 */

import { DYNAMIC, mapOf, type RecordType, record, type Type, union } from "./type.types.js";
import { prune } from "./unify.js";

/** A map being built: the fields it has so far, and what it says about the rest. */
export interface Poured {
  readonly fields: Map<string, Type>;
  /** True once something was poured in whose keys are not all known. */
  open: boolean;
  /** What a key nobody named holds, when every such key holds the same thing. */
  rest?: Type;
}

/** Nothing poured in yet: no fields, and no claim about what else is there. */
export function emptyPour(): Poured {
  return { fields: new Map(), open: false };
}

/**
 * Pour one map into another.
 *
 * @param into What is being built.
 * @param from The map being poured in, whatever it turns out to be.
 * @param deep Whether a field both of them carry as a map is poured rather than
 * replaced, which is what tells `merge` from `mergeDeep`.
 * @returns true when it was a map at all. False means nothing can be claimed
 * about the result, and the caller is the one who says so.
 */
export function pour(into: Poured, from: Type, deep = false): boolean {
  const held = prune(from);
  if (held.kind !== "record") return false;
  for (const [name, type] of held.fields) into.fields.set(name, field(into, name, type, deep));
  if (!held.open) return true;
  into.open = true;
  into.rest = held.rest ? union([...(into.rest ? [into.rest] : []), held.rest]) : undefined;
  return true;
}

/** Deep pours a field both sides carry as a map; otherwise the later one wins. */
function field(into: Poured, name: string, type: Type, deep: boolean): Type {
  const held = into.fields.get(name);
  if (!deep || !held) return type;
  const under = emptyPour();
  return pour(under, held) && pour(under, type, true) ? shapeOf(under) : type;
}

/** The map that was built, said as a type. */
export function shapeOf(poured: Poured): Type {
  if (poured.rest && poured.fields.size === 0) return mapOf(poured.rest);
  return record(poured.fields, poured.open, poured.rest);
}

/**
 * Both maps as one, or nothing when either is not a map the checker knows.
 *
 * @param left The one being poured into.
 * @param right The one poured in, whose fields win where they meet.
 * @param deep Whether fields that are both maps are poured into each other.
 */
export function bothAsOne(left: Type, right: Type, deep = false): RecordType | undefined {
  const into = emptyPour();
  if (!pour(into, left, deep) || !pour(into, right, deep)) return undefined;
  const shape = shapeOf(into);
  return shape.kind === "record" ? shape : undefined;
}

/** A value poured in whose shape nothing is known about leaves nothing known. */
export const UNKNOWN: Type = DYNAMIC;
