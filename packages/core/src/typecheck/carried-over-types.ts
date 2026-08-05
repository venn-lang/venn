/**
 * The type words a reader arrives with, and what each one is called here.
 *
 * A typo sits a letter or two from the right name, and the spelling search
 * finds it. A word carried over from another language does not: `text` and
 * `string` share two letters, `nothing` and `null` share one, and no edit
 * distance loose enough to offer those would be safe on real names. So the
 * spellings people reach for first are answered by name instead.
 *
 * Looked up lower-cased, because `Text` and `Boolean` are the same mistake.
 */
export const CARRIED_OVER_TYPES: Readonly<Record<string, string>> = {
  any: "dynamic",
  array: "list",
  boolean: "bool",
  char: "string",
  date: "instant",
  datetime: "instant",
  dict: "map",
  dictionary: "map",
  double: "number",
  err: "error",
  exception: "error",
  float: "number",
  int: "number",
  integer: "number",
  nil: "null",
  none: "null",
  nothing: "null",
  object: "map",
  promise: "task",
  record: "map",
  regexp: "regex",
  str: "string",
  text: "string",
  timestamp: "instant",
  undefined: "null",
  unit: "void",
  unknown: "dynamic",
};
