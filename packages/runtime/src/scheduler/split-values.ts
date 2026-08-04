/**
 * Tell a verb's positional arguments from its options map, when only the values
 * are left.
 *
 * `splitCall` answers the same question about the expressions a call was written
 * with, and the two have to agree: `crypto.hash("x", { algorithm: "sha512" })`
 * means the same thing in a `const` as it does inside a `print`, and for a long
 * time it did not, because the expression path had no splitter at all and let
 * the schema supply its defaults.
 */

import type { SplitValues } from "./split-values.types.js";

/**
 * Split evaluated arguments the way {@link splitCall} splits written ones.
 *
 * @param args.values Every value the call was given, in order.
 * @param args.takes How many positionals the verb declared.
 * @param args.options The option names it declared, `true` for any, `false` for
 * a verb that takes no options at all.
 * @returns The positionals, and the trailing map when there is one.
 */
export function splitValues(args: {
  values: readonly unknown[];
  takes: number;
  options: readonly string[] | boolean;
}): SplitValues {
  const { values, takes, options } = args;
  const last = values[values.length - 1];
  if (!isPlainMap(last)) return { args: values, opts: undefined };
  const map = last as Record<string, unknown>;
  if (values.length <= takes && !onlyDeclaredKeys(options, map)) {
    return { args: values, opts: undefined };
  }
  return { args: values.slice(0, -1), opts: map };
}

/** Whether every key this map writes is one the verb accepts as an option. */
function onlyDeclaredKeys(
  options: readonly string[] | boolean,
  map: Record<string, unknown>,
): boolean {
  const keys = Object.keys(map);
  if (options === false) return false;
  if (options === true) return keys.length > 0;
  const known = new Set(options);
  return keys.every((key) => known.has(key));
}

/**
 * A map as the language means one: not a list, not a `fn`, not a value a plugin
 * gave a class of its own. A duration handed to `wait` is an argument.
 */
function isPlainMap(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}
