/**
 * How a value reads once it is written into text.
 *
 * A list and a map read the way they are written in a program, so a reader sees
 * what they hold and could type it back. No value here can read as
 * `[object Object]`: those are the host's words for a value nobody described,
 * and they say nothing about the program that printed one.
 *
 * The one writer. `fmt.table`, and every plugin through `ctx.show`, comes here
 * rather than keeping a scalar writer of its own, which is how csv, yaml, xml
 * and json each used to leak `{"kind":"duration","ms":250}` where `250ms` was
 * meant.
 *
 * `kindOf` comes from `value/`, which owns the question of what a value is, and
 * the two are imported directly rather than through `expr`'s barrel, which
 * reaches the evaluator, which reaches the compiler, which reaches this file.
 */

import type { Pattern } from "../expr/methods/regex-methods.js";
import type { Instant, UnitValue } from "../units/index.js";
import { kindOf } from "../value/index.js";

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

/** The three that share one writer, since each is a number and a name for it. */
const UNIT_KINDS = new Set(["duration", "size", "percent"]);

function structured(value: object, seen: Set<object>): string {
  const kind = kindOf(value);
  if (UNIT_KINDS.has(kind)) return unitText(value as UnitValue);
  if (kind === "instant") return (value as Instant).iso || String((value as Instant).epochMs);
  if (kind === "fn") return "<fn>";
  if (kind === "task") return "<task>";
  if (kind === "regex") return patternText(value as Pattern);
  const declared = declaredText(value);
  if (declared !== undefined) return declared;
  // A map that holds itself has no text, and walking it has no end.
  if (seen.has(value)) return "<circular>";
  return walk(value, seen);
}

/**
 * The text a value declares for itself, when it declares one.
 *
 * A `Secret` is why. It keeps its raw value in a closure and publishes a
 * `toString` and a `toJSON` that both answer the marker, so it redacts through
 * `String(s)` and `JSON.stringify(s)`. This writer is the third route, and the
 * one the language itself takes: without this, `ctx.show(s)`, `print s` and
 * every `fmt` format wrote out `{ reveal: <fn>, toString: <fn>, toJSON: <fn> }`
 * and the promise that a secret redacts by any route was two thirds true.
 *
 * Own properties, and host functions. A Venn closure is an object rather than a
 * function, so a map literal written `{ toString: fn () => "x" }` is data with
 * a key spelled `toString` and is walked like any other map.
 */
function declaredText(value: object): string | undefined {
  for (const name of ["toJSON", "toString"] as const) {
    if (!Object.hasOwn(value, name)) continue;
    const say: unknown = (value as Record<string, unknown>)[name];
    if (typeof say !== "function") continue;
    const text: unknown = (say as () => unknown).call(value);
    if (typeof text === "string") return text;
  }
  return undefined;
}

/** As a program writes one, so a printed pattern could be typed back in. */
function patternText(value: Pattern): string {
  const source = `regex(r"${value.source}"`;
  return value.flags ? `${source}, "${value.flags}")` : `${source})`;
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
