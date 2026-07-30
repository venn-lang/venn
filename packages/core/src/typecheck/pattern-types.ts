/**
 * What a pattern binds, worked out from the type of the value it takes apart.
 *
 * This is where a pattern earns the annotation: a field the shape does not carry
 * is a mistake at the line that wrote it, rather than a `null` that turns up
 * somewhere else entirely.
 */

import type { FieldPattern, Pattern } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { Infer } from "./infer.js";
import { DYNAMIC, type Type } from "./type.types.js";
import { fieldType, prune } from "./unify.js";

/** One name a pattern binds, with what it holds. */
export type Bound = readonly [name: string, type: Type];

/**
 * Every name a pattern binds, typed against the value.
 *
 * @param args The pattern, the type of what it is taking apart, and where a
 * field nobody carries is reported.
 * @returns One entry per name, in the order the pattern names them.
 */
export function patternTypes(args: { pattern: Pattern; type: Type; infer: Infer }): Bound[] {
  const { pattern, type, infer } = args;
  if (ast.isNamePattern(pattern)) return [[pattern.name, type]];
  if (ast.isListPattern(pattern)) return items(pattern, type, infer);
  const held = prune(type);
  if (!open(held) && held.kind !== "record") return [notA(pattern, held, "map", infer)];
  return pattern.fields.flatMap((field) => fieldOf(field, held, infer));
}

/** A type that could still turn out to be anything, which is nobody's mistake. */
function open(type: Type): boolean {
  return type.kind === "dynamic" || type.kind === "var";
}

function fieldOf(field: FieldPattern, held: Type, infer: Infer): Bound[] {
  const found = held.kind === "record" ? fieldType(held, field.name) : DYNAMIC;
  if (!found) return [missing(field, held, infer)];
  if (!field.value) return [[field.name, found]];
  return patternTypes({ pattern: field.value, type: found, infer });
}

function items(pattern: ast.ListPattern, type: Type, infer: Infer): Bound[] {
  const held = prune(type);
  if (open(held)) return pattern.items.flatMap((item) => under(item, DYNAMIC, infer));
  if (held.kind !== "list") return [notA(pattern, held, "list", infer)];
  return pattern.items.flatMap((item) => under(item, held.element, infer));
}

function under(pattern: Pattern, type: Type, infer: Infer): Bound[] {
  return patternTypes({ pattern, type, infer });
}

/** A field the shape does not carry, reported where the name was written. */
function missing(field: FieldPattern, held: Type, infer: Infer): Bound {
  infer.ctx.mismatches.push({
    node: field,
    expected: held,
    actual: DYNAMIC,
    note: `has no field "${field.name}"`,
  });
  return [field.name, DYNAMIC];
}

/** A value of the wrong shape entirely: `{ … }` over a number, `[ … ]` over a map. */
function notA(pattern: Pattern, held: Type, shape: string, infer: Infer): Bound {
  infer.ctx.mismatches.push({
    node: pattern,
    expected: held,
    actual: DYNAMIC,
    note: `is not a ${shape}, so it cannot be taken apart as one`,
  });
  return ["", DYNAMIC];
}
