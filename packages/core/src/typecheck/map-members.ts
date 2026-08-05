import { createContext, type TypeContext } from "./context.js";
import { declared } from "./declared.js";
import {
  BOOL,
  callback,
  DYNAMIC,
  fn,
  list,
  mapOf,
  NUMBER,
  type RecordType,
  STRING,
  type Type,
  union,
  variadic,
} from "./type.types.js";

/**
 * What a key may be written as. A key is a name, and a number reads as one:
 * `keyBy(n => n)` files an item under `"3"`, and `has(3)` asks about that same
 * key rather than about a different one.
 */
const KEY: Type = union([STRING, NUMBER]);

/**
 * What a map answers to, with the value type carried through.
 *
 * A map is a record here, whether it was written as `map<string>` or as a shape:
 * both know what their values hold, so both can say what `values` gives back and
 * what `mapValues` is handed.
 *
 * @param receiver The map's type.
 * @param name The member being read.
 * @param ctx Where fresh variables come from.
 * @returns undefined when the map carries a field by that name, so the field
 * wins, and when there is no such member at all.
 */
export function recordMember(
  receiver: RecordType,
  name: string,
  ctx: TypeContext,
): Type | undefined {
  if (receiver.fields.has(name)) return undefined;
  return declared(recordTable(valuesOf(receiver), ctx.fresh()), name);
}

/**
 * Every member a map answers to, the names alone.
 *
 * Taken from the table that answers them rather than written out again, since
 * two lists of the same names are two lists that drift.
 * `value/member-tables-agree.test.ts` holds this against the runtime's table
 * and the editor's docs.
 */
export const MAP_MEMBER_NAMES: readonly string[] = Object.keys(
  recordTable(DYNAMIC, createContext().fresh()),
);

function recordTable(value: Type, into: Type): Record<string, Type> {
  return {
    keys: list(STRING),
    values: list(value),
    entries: list(list(union([STRING, value]))),
    len: NUMBER,
    has: fn([KEY], BOOL),
    get: fn([KEY], value),
    merge: fn([DYNAMIC], DYNAMIC),
    mergeDeep: fn([DYNAMIC], DYNAMIC),
    // A map's callbacks are handed the key alongside the value, or the other
    // way round for `mapKeys`. Taking the second one is optional.
    mapValues: fn([callback([value, STRING], into, 1)], mapOf(into)),
    mapKeys: fn([callback([STRING, value], STRING, 1)], mapOf(value)),
    // Fewer keys than were listed, so the result is a map of the same values
    // rather than the shape it started as.
    filterValues: fn([callback([value, STRING], BOOL, 1)], mapOf(value)),
    // As many names as you like, or one list of them.
    pick: variadic([KEY], mapOf(value)),
    omit: variadic([KEY], mapOf(value)),
    // Keys become values, and a key is a name.
    invert: mapOf(STRING),
    isEmpty: BOOL,
    getPath: fn([STRING], DYNAMIC),
    hasPath: fn([STRING], BOOL),
  };
}

/**
 * What every value in a map is. `map<V>` says so outright; a shape says it by
 * listing its fields; a map that says neither holds anything.
 */
function valuesOf(receiver: RecordType): Type {
  if (receiver.rest) return receiver.rest;
  const fields = [...receiver.fields.values()];
  return fields.length > 0 ? union(fields) : DYNAMIC;
}
