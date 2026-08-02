/**
 * How a value reads once it is written into text.
 *
 * A list and a map read the way they are written in a program, so a reader sees
 * what they hold and could type it back. No value here can read as
 * `[object Object]`: those are the host's words for a value nobody described,
 * and they say nothing about the program that printed one.
 *
 * The brands come from the files that define them rather than from `expr`'s
 * barrel, which reaches the evaluator, which reaches the compiler, which reaches
 * this file.
 */

import { isClosure } from "../expr/closure.js";
import { isNativeFn } from "../expr/native.types.js";
import { isTask } from "../expr/task.js";
import { isInstant, isUnitValue, type UnitValue } from "../units/index.js";

const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * How a filled placeholder reads. One definition, because a title and a string
 * showing the same value must not disagree about what it looks like.
 *
 * @param value What the placeholder evaluated to.
 * @returns Its text: a string as itself, a list as `[1, 2]`, a map as
 * `{ name: "ada" }`, a moment as its ISO text. Nothing at all for null and
 * undefined, since a title reading `add ${name}` with no name is better as
 * `add ` than as `add null`.
 */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return write(value, new Set());
}

/**
 * The same value, the way `print` and `str` show it.
 *
 * One definition with {@link stringifyValue}, because `print x` and `"${x}"` two
 * lines apart showing the same value differently is worse than either being
 * wrong on its own. `print` is how anybody looks at a value while working
 * something out, and it used to answer with the interpreter's own shape:
 * `{"kind":"duration","ms":300}` for `300ms`, and JSON for every map.
 *
 * One rule differs, and only at the top. Nothing prints as `null`, because
 * `print x` asked what `x` is and deserves an answer, while an interpolation is
 * a sentence with a gap in it and `add ${name}` with no name reads better as
 * `add ` than as `add null`.
 *
 * @param value What to show.
 * @returns Its text, the same as an interpolation would give, except that null
 * and undefined read as `null`.
 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  return write(value, new Set());
}

/**
 * The same value one level in, where the rules differ: a string is quoted so a
 * list of words reads as one, and nothing is `null` so a list keeps its length.
 */
function write(value: unknown, seen: Set<object>): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return structured(value, seen);
  return typeof value === "function" ? "<fn>" : String(value);
}

function structured(value: object, seen: Set<object>): string {
  if (isUnitValue(value)) return unitText(value);
  if (isInstant(value)) return value.iso || String(value.epochMs);
  if (isClosure(value) || isNativeFn(value)) return "<fn>";
  if (isTask(value)) return "<task>";
  // A map that holds itself has no text, and walking it has no end.
  if (seen.has(value)) return "<circular>";
  return walk(value, seen);
}

function walk(value: object, seen: Set<object>): string {
  seen.add(value);
  const text = Array.isArray(value) ? writeList(value, seen) : writeMap(value, seen);
  seen.delete(value);
  return text;
}

function writeList(values: readonly unknown[], seen: Set<object>): string {
  return `[${values.map((each) => write(each, seen)).join(", ")}]`;
}

function writeMap(value: object, seen: Set<object>): string {
  const parts = Object.entries(value).map(
    ([name, held]) => `${keyText(name)}: ${write(held, seen)}`,
  );
  return parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
}

function keyText(name: string): string {
  return BARE_KEY.test(name) ? name : JSON.stringify(name);
}

function unitText(value: UnitValue): string {
  if (value.kind === "duration") return `${value.ms}ms`;
  if (value.kind === "size") return `${value.bytes}b`;
  return `${value.ratio * 100}%`;
}
