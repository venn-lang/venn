import type { Expr, Pattern } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { strictEquals } from "../value/index.js";
import type { Step } from "./pattern-slots.js";
import { readPath } from "./read-path.js";

/** What a pattern can ask a value to be. */
export type Asked = string | number | boolean | null;

/**
 * One question a pattern asks: what has to be at this path for it to match.
 *
 * A shape is a question too. `{ user: { name } }` used to ask nothing at all,
 * because only a literal made a test, so it matched a number, a string and a
 * list alike and bound `name` to nothing. What made that expensive is that the
 * arm still ran: the wrong branch computed a wrong answer rather than failing.
 */
export type PatternTest =
  | { readonly path: readonly Step[]; readonly asks: "is"; readonly value: Asked }
  | {
      readonly path: readonly Step[];
      readonly asks: "a list";
      /** How many items the pattern names. */
      readonly items: number;
      /** Whether a `...rest` takes whatever is past them. */
      readonly rest: boolean;
    }
  | { readonly path: readonly Step[]; readonly asks: "a map"; readonly keys: readonly string[] };

/**
 * Every question a pattern asks, each with the way to what it asks about.
 *
 * A bare name binds and asks nothing, so a pattern that is only a name matches
 * anything. That is what makes the last arm of a `match` the one nobody has to
 * write a condition for, and it is the only pattern that does it.
 *
 * @param pattern The pattern, of any shape and any depth.
 * @returns One test per literal and per shape in it, outside in.
 */
export function patternTests(pattern: Pattern): PatternTest[] {
  const found: PatternTest[] = [];
  collect(pattern, [], found);
  return found;
}

/**
 * Whether a value answers every question a pattern asks.
 *
 * @param value What is being matched.
 * @param tests What {@link patternTests} read off the pattern.
 * @returns true when the pattern matches, so the arm is the one that runs.
 */
export function answers(value: unknown, tests: readonly PatternTest[]): boolean {
  return tests.every((test) => holds(readPath(value, test.path), test));
}

function holds(held: unknown, test: PatternTest): boolean {
  if (test.asks === "is") return strictEquals(held, test.value);
  if (test.asks === "a list") return isList(held, test.items, test.rest);
  return isMap(held) && test.keys.every((key) => key in (held as object));
}

/**
 * A list of the length the pattern names, or at least that many where a
 * `...rest` takes the remainder. `[a, b]` matching a list of three bound `a` and
 * `b` and threw the third away, which is a pattern claiming to describe a shape
 * it did not describe.
 */
function isList(held: unknown, items: number, rest: boolean): boolean {
  if (!Array.isArray(held)) return false;
  return rest ? held.length >= items : held.length === items;
}

/**
 * Something a field can be read off: not null, not a list.
 *
 * Not `typeName`'s idea of a map, which files an object carrying a `kind` under
 * that kind instead. A `kind` field is how this language spells a union, so
 * `{ kind: "ping", at }` is the very shape a map pattern exists to match.
 */
function isMap(held: unknown): boolean {
  return held !== null && typeof held === "object" && !Array.isArray(held);
}

function collect(pattern: Pattern, path: Step[], into: PatternTest[]): void {
  if (ast.isLiteralPattern(pattern)) {
    into.push({ path: [...path], asks: "is", value: asked(pattern.value) });
    return;
  }
  if (ast.isListPattern(pattern)) {
    into.push({
      path: [...path],
      asks: "a list",
      items: pattern.items.length,
      rest: !!pattern.rest,
    });
    pattern.items.forEach((item, at) => {
      collect(item, [...path, at], into);
    });
    return;
  }
  if (!ast.isMapPattern(pattern)) return;
  into.push({ path: [...path], asks: "a map", keys: pattern.fields.map((one) => one.name) });
  for (const field of pattern.fields) {
    if (field.value) collect(field.value, [...path, field.name], into);
  }
}

/** The value a literal stands for, read off the node the grammar built for it. */
export function asked(literal: Expr): Asked {
  if (ast.isStringLit(literal)) return literal.value;
  if (ast.isNumberLit(literal)) return Number(literal.raw);
  if (ast.isBoolLit(literal)) return literal.value === "true";
  return null;
}
