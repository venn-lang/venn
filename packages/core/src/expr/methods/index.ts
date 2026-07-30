import type { Invoke } from "../native.types.js";
import { isTask, TASK_METHODS } from "../task.js";
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

/** Every member name a value of this kind answers to. Read by the editor. */
export const MEMBER_NAMES: Readonly<Record<string, readonly string[]>> = {
  list: Object.keys(LIST_TABLE),
  string: Object.keys(STRING_TABLE),
  map: Object.keys(MAP_TABLE),
  number: Object.keys(NUMBER_TABLE),
  task: Object.keys(TASK_METHODS),
  duration: Object.keys(DURATION_METHODS),
  size: Object.keys(SIZE_METHODS),
  percent: Object.keys(PERCENT_METHODS),
};

/**
 * The built-in member of a native value: a property like `length` or a callable
 * like `map`. `NO_METHOD` when the type has no such member, so the caller can
 * fall back to a map's own data.
 */
export function builtinMember(receiver: unknown, member: string, invoke: Invoke): unknown {
  const table = tableFor(receiver);
  // These tables are ordinary objects, so a plain lookup would also reach what
  // every object inherits: `x.toString` would find `Object.prototype.toString`
  // and answer for a member the language never had. Only what a table declares
  // is a member.
  if (!table || !Object.hasOwn(table, member)) return NO_METHOD;
  const method = table[member];
  if (!method) return NO_METHOD;
  return (method as (r: unknown, i: Invoke) => unknown)(receiver, invoke);
}

// Keyed by the `kind` a value carries. A pattern is here rather than beside the
// units because it is dispatched the same way, not because it is one.
const UNIT_TABLES: Record<string, Record<string, unknown>> = {
  duration: DURATION_METHODS,
  size: SIZE_METHODS,
  percent: PERCENT_METHODS,
  regex: REGEX_METHODS,
};

function tableFor(receiver: unknown): Record<string, unknown> | undefined {
  if (typeof receiver === "string") return STRING_TABLE;
  if (typeof receiver === "number") return NUMBER_TABLE;
  if (Array.isArray(receiver)) return LIST_TABLE;
  if (receiver === null || typeof receiver !== "object") return undefined;
  if (isTask(receiver)) return TASK_METHODS;
  // A unit value carries its kind, and its methods are the way back to a number.
  const kind = (receiver as { kind?: unknown }).kind;
  return (typeof kind === "string" ? UNIT_TABLES[kind] : undefined) ?? MAP_TABLE;
}
