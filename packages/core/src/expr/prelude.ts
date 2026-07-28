import { isClosure } from "./closure.js";
import { invoke } from "./invoke.js";
import { isNativeFn, nativeFn } from "./native.types.js";
import { startTask } from "./task.js";

/**
 * Render a value the way `print` and `str` do: a string as itself, anything
 * else as JSON. A value JSON cannot hold falls back to its plain text rather
 * than throwing, because printing must never be the thing that fails a flow.
 */
export function display(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * The name of a value's type, as the language talks about it: "null", "list",
 * "fn", "map", "bool", "string", "number", or a unit's own kind.
 */
export function typeName(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "list";
  if (isClosure(value) || isNativeFn(value)) return "fn";
  const kind = (value as { kind?: unknown }).kind;
  if (typeof value === "object" && typeof kind === "string") return kind;
  if (typeof value === "object") return "map";
  return typeof value === "boolean" ? "bool" : typeof value;
}

/** `range(3)` → [0,1,2]; `range(1, 4)` → [1,2,3]; `range(0, 10, 2)` → [0,2,4,6,8]. */
function range(args: readonly unknown[]): number[] {
  const [a, b, c] = args.map(Number);
  const from = args.length > 1 ? (a ?? 0) : 0;
  const to = args.length > 1 ? (b ?? 0) : (a ?? 0);
  const step = c && c !== 0 ? c : from <= to ? 1 : -1;
  const out: number[] = [];
  for (let n = from; step > 0 ? n < to : n > to; n += step) out.push(n);
  return out;
}

/**
 * The whole prelude of values: what has no receiver to hang off.
 *
 * `len(xs)`, `sum(xs)`, `keys(m)` and `round(x, 2)` are deliberately absent:
 * they read better as `xs.len`, `xs.sum`, `m.keys` and `x.round(2)`, and a
 * second spelling would only be a second way to say the same thing. Those names
 * are also exactly the ones a script wants to bind (`const sum = …`), and a
 * binding would silently shadow them.
 */
export const PRELUDE_VALUES: Readonly<Record<string, unknown>> = {
  // Builds a list out of nothing: there is no receiver to ask.
  range: nativeFn(range),
  // Works on `null`, which can carry no method of its own.
  str: nativeFn((args) => args.map(display).join(" ")),
  typeOf: nativeFn((args) => typeName(args[0])),
  // `fmt.json(x, 2)` without the import: the everyday "show me this".
  pretty: nativeFn((args) => prettyJson(args[0])),
  // Start work without stopping for it. Everything else waits by itself, so
  // this is the only way to say "carry on"; `.wait` asks for it back.
  spawn: nativeFn((args) => startTask(() => invoke(args[0], []))),
};

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
