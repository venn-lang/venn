import type { Pattern } from "../generated/ast.js";
import * as ast from "../generated/ast.js";

/** One step into a value: a field by name, or an item by position. */
export type Step = string | number;

/** One name a pattern binds, and where in the value it is read from. */
export interface PatternSlot {
  readonly name: string;
  /** From the outside in. Empty when the pattern is the name itself. */
  readonly path: readonly Step[];
}

/**
 * Every name a pattern binds, each with the way to its value.
 *
 * Worked out once, where the pattern is written, so taking a value apart at run
 * time is a walk down a list of steps rather than another look at the tree.
 *
 * @param pattern The pattern, of any shape and any depth.
 * @returns One slot per name, in the order the pattern names them.
 */
export function patternSlots(pattern: Pattern): PatternSlot[] {
  const found: PatternSlot[] = [];
  collect(pattern, [], found);
  return found;
}

/** Just the names, for a scope that only needs to know what is bound. */
export function patternNames(pattern: Pattern): string[] {
  return patternSlots(pattern).map((slot) => slot.name);
}

function collect(pattern: Pattern, path: Step[], into: PatternSlot[]): void {
  if (ast.isNamePattern(pattern)) {
    into.push({ name: pattern.name, path: [...path] });
    return;
  }
  if (ast.isListPattern(pattern)) {
    items(pattern, path, into);
    return;
  }
  // A literal asks a question rather than giving a name to the answer.
  if (!ast.isMapPattern(pattern)) return;
  for (const field of pattern.fields) {
    const inner = [...path, field.name];
    if (field.value) collect(field.value, inner, into);
    else into.push({ name: field.name, path: inner });
  }
}

function items(pattern: ast.ListPattern, path: Step[], into: PatternSlot[]): void {
  pattern.items.forEach((item, at) => {
    collect(item, [...path, at], into);
  });
}
