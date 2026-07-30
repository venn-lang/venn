import type { Expr, Pattern } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { strictEquals } from "../value/index.js";
import type { Step } from "./pattern-slots.js";
import { readPath } from "./read-path.js";

/** What a pattern can ask a value to be. */
export type Asked = string | number | boolean | null;

/** One question a pattern asks: what has to be at this path for it to match. */
export interface PatternTest {
  readonly path: readonly Step[];
  readonly value: Asked;
}

/**
 * Every question a pattern asks, each with the way to what it asks about.
 *
 * A name binds and asks nothing, so a pattern made only of names matches
 * anything. That is what makes the last arm of a `match` the one nobody has to
 * write a condition for.
 *
 * @param pattern The pattern, of any shape and any depth.
 * @returns One test per literal in it, in the order they are written.
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
  return tests.every((test) => strictEquals(readPath(value, test.path), test.value));
}

function collect(pattern: Pattern, path: Step[], into: PatternTest[]): void {
  if (ast.isLiteralPattern(pattern)) {
    into.push({ path: [...path], value: asked(pattern.value) });
    return;
  }
  if (ast.isListPattern(pattern)) {
    pattern.items.forEach((item, at) => {
      collect(item, [...path, at], into);
    });
    return;
  }
  if (!ast.isMapPattern(pattern)) return;
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
