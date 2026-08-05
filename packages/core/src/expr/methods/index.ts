import { kindOf } from "../../value/index.js";
import type { Invoke } from "../native.types.js";
import { TASK_METHODS } from "../task.js";
import { INSTANT_METHODS } from "./instant-methods.js";
import { LIST_GROUPING } from "./list-grouping.js";
import { LIST_METHODS } from "./list-methods.js";
import { LIST_SELECTION } from "./list-selection.js";
import { MAP_EXTRAS } from "./map-extras.js";
import { MAP_METHODS } from "./map-methods.js";
import { NUMBER_METHODS } from "./number-methods.js";
import { REGEX_METHODS } from "./regex-methods.js";
import { STRING_EXTRAS } from "./string-extras.js";
import { STRING_METHODS } from "./string-methods.js";
import { DURATION_METHODS, NUMBER_TO_UNIT, PERCENT_METHODS, SIZE_METHODS } from "./unit-methods.js";

/** Distinguishes "no such method" from a method that legitimately returns undefined. */
export const NO_METHOD = Symbol("venn.no-method");

const LIST_TABLE = { ...LIST_METHODS, ...LIST_SELECTION, ...LIST_GROUPING };
const STRING_TABLE = { ...STRING_METHODS, ...STRING_EXTRAS };
const MAP_TABLE = { ...MAP_METHODS, ...MAP_EXTRAS };
const NUMBER_TABLE = { ...NUMBER_METHODS, ...NUMBER_TO_UNIT };

/**
 * Every table, keyed by the kind of value that answers to it.
 *
 * A pattern is here rather than beside the units because it is dispatched the
 * same way, not because it is one. The kinds with no entry (`null`, `bool`,
 * `fn`, `handle`) answer to nothing the language declares: a handle answers to
 * what it published, and the other three answer to nothing at all.
 */
const TABLES: Readonly<Record<string, Record<string, unknown>>> = {
  list: LIST_TABLE,
  string: STRING_TABLE,
  map: MAP_TABLE,
  number: NUMBER_TABLE,
  task: TASK_METHODS,
  duration: DURATION_METHODS,
  size: SIZE_METHODS,
  percent: PERCENT_METHODS,
  instant: INSTANT_METHODS,
  regex: REGEX_METHODS,
};

/**
 * Every member name a value of this kind answers to, taken from the tables that
 * answer them, so the published list cannot drift from what runs.
 *
 * This is the runtime's half of the three-way agreement the checker's members
 * and the editor's docs are held to; `value/member-tables-agree.test.ts` is
 * where they are held.
 */
export const MEMBER_NAMES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(TABLES).map(([kind, table]) => [kind, Object.keys(table)]),
);

/**
 * The built-in member of a native value: a property like `length` or a callable
 * like `map`. `NO_METHOD` when the type has no such member, so the caller can
 * fall back to a map's own data.
 */
export function builtinMember(receiver: unknown, member: string, invoke: Invoke): unknown {
  const table = TABLES[kindOf(receiver)];
  // These tables are ordinary objects, so a plain lookup would also reach what
  // every object inherits: `x.toString` would find `Object.prototype.toString`
  // and answer for a member the language never had. Only what a table declares
  // is a member.
  if (!table || !Object.hasOwn(table, member)) return NO_METHOD;
  const method = table[member];
  if (!method) return NO_METHOD;
  return (method as (r: unknown, i: Invoke) => unknown)(receiver, invoke);
}
