import { displayValue } from "../interpolation/stringify-value.js";
import { kindOf } from "../value/index.js";
import { stepOfZero } from "./argument-refusal.js";
import { numeric } from "./counted-argument.js";
import { invoke } from "./invoke.js";
import { pattern } from "./methods/regex-methods.js";
import { nativeFn } from "./native.types.js";
import { startTask } from "./task.js";

/**
 * Render a value the way `print` and `str` do, which is the way `${}` does.
 *
 * One definition rather than two: this used to answer with JSON, so `print
 * 300ms` gave `{"kind":"duration","ms":300}` while `"${300ms}"` two lines later
 * gave `300ms`. Whichever of those a reader saw first, the other one taught them
 * that the language does not know its own mind.
 */
export function display(value: unknown): string {
  return displayValue(value);
}

/**
 * The name of a value's type, as the language talks about it.
 *
 * One of the kinds the language has, and never anything else. It used to hand
 * back whatever `kind` string an object carried, so an ordinary map written
 * `{ kind: "size", label: "x" }` answered `"size"` and `typeOf` could name a
 * type nothing else in the language knows about.
 *
 * @param value Anything at all.
 * @returns "null", "bool", "number", "string", "list", "map", "fn", a unit's
 * own kind, "instant", "regex", "task", or "handle" for what a plugin made.
 */
export function typeName(value: unknown): string {
  return kindOf(value);
}

/**
 * `range(3)` gives [0,1,2]; `range(1, 4)` gives [1,2,3]; `range(0, 10, 2)`
 * gives [0,2,4,6,8].
 *
 * A step of zero used to become a step of one, so a loop written to walk in
 * tens walked in ones and answered ten times as many items as it was asked
 * for. There is no range with a step of zero, so it is refused rather than
 * guessed at; a step left out still means one, up or down.
 */
function range(args: readonly unknown[]): number[] {
  const first = numeric(args[0], { verb: "range", what: "start" });
  const from = args.length > 1 ? first : 0;
  const to = args.length > 1 ? numeric(args[1], { verb: "range", what: "end" }) : first;
  const step = args.length > 2 ? stepOf(args[2]) : from <= to ? 1 : -1;
  const out: number[] = [];
  for (let n = from; step > 0 ? n < to : n > to; n += step) out.push(n);
  return out;
}

/** Written out, so a zero is the caller's mistake rather than a default. */
function stepOf(value: unknown): number {
  const step = numeric(value, { verb: "range", what: "step" });
  if (step === 0) throw stepOfZero();
  return step;
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
  // A pattern is compiled where it is written, so a `~=` in a loop compiles once
  // and a pattern that does not compile is found on the line that wrote it.
  regex: nativeFn((args) => pattern(String(args[0] ?? ""), String(args[1] ?? ""))),
};

/**
 * The kinds JSON has a shape for. Everything else is shown the way `print`
 * shows it, because the alternative is the interpreter's own storage: `pretty`
 * used to answer `{"kind":"duration","ms":250}` for `250ms` while `print 250ms`
 * two lines away said `250ms`, which is one file contradicting itself.
 */
const AS_JSON = new Set(["null", "bool", "number", "string", "list", "map", "handle"]);

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, shown, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function shown(_key: string, held: unknown): unknown {
  return AS_JSON.has(kindOf(held)) ? held : display(held);
}
