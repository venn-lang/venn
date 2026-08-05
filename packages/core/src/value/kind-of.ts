/**
 * What a value is, asked once.
 *
 * Everything that dispatches on the shape of a value asks here: the member
 * read, the method tables, `typeOf`, and how a value is written into text. They
 * used to each decide for themselves, in six different orders, and they
 * disagreed: a task read as a map, a raw host function read as `"function"`,
 * and a pattern read as a map that happened to hold a `RegExp`.
 *
 * The brands come from the files that define them rather than from `expr`'s
 * barrel, which reaches the evaluator, which reaches the compiler, which
 * reaches this file. `interpolation/stringify-value.ts` imports the same way and
 * for the same reason.
 */

import { isClosure } from "../expr/closure.js";
import { isPattern } from "../expr/methods/regex-methods.js";
import { isNativeFn } from "../expr/native.types.js";
import { isTask } from "../expr/task.js";
import { isDuration, isInstant, isPercent, isSize } from "../units/index.js";
import type { ValueKind } from "./kind.types.js";

/**
 * Which kind of value this is.
 *
 * @param value Anything at all, including what the host handed over and what
 * has not arrived yet.
 * @returns One of the kinds the language has. Never a name off the value
 * itself: a map carrying `kind: "size"` is a map, because a size also has to
 * carry the bytes.
 */
export function kindOf(value: unknown): ValueKind {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return primitiveKind(typeof value);
  if (Array.isArray(value)) return "list";
  return objectKind(value);
}

function primitiveKind(held: string): ValueKind {
  if (held === "boolean") return "bool";
  if (held === "number") return "number";
  if (held === "string") return "string";
  // A bare host function is callable, so it is a `fn`. A symbol and a bigint
  // are the host's own and the language can say nothing about either, which is
  // what a handle is: a bigint answered "number" here until it reached the
  // number methods, and `Math.abs` threw a host `TypeError` with no code and no
  // span, which is the one answer a member read must never give.
  return held === "function" ? "fn" : "handle";
}

/**
 * The branded shapes first, then the line between a map and a handle.
 */
function objectKind(value: object): ValueKind {
  if (isClosure(value) || isNativeFn(value)) return "fn";
  if (isTask(value)) return "task";
  if (isDuration(value)) return "duration";
  if (isSize(value)) return "size";
  if (isPercent(value)) return "percent";
  if (isInstant(value)) return "instant";
  if (isPattern(value)) return "regex";
  return plain(value) ? "map" : "handle";
}

/**
 * Whether this is the language's own data rather than something the host built.
 *
 * A map literal inherits from nothing but `Object`, while a handle is built by
 * the host and carries its verbs on a prototype of its own. The chain is walked
 * rather than compared once because a literal written with a `__proto__` key
 * has had its prototype replaced by more data, and data with data behind it is
 * still data: `{ "__proto__": { pwned: 7 } }` was called a handle, which had
 * `typeOf` naming a plugin for a value no plugin ever touched. What marks a
 * host's prototype is the `constructor` it carries back to what built it; a map
 * carries none.
 */
function plain(value: object): boolean {
  let proto = Object.getPrototypeOf(value) as object | null;
  while (proto !== null && proto !== Object.prototype) {
    if (Object.hasOwn(proto, "constructor")) return false;
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return true;
}
