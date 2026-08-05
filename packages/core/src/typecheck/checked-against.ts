/**
 * The expressions that are typed by the place they were written, not only by
 * what is inside them: the two literals with parts, and a lambda.
 *
 * Inference otherwise works outwards: an expression is given the type its parts
 * turned out to have, and whatever it was written into is checked against that
 * afterwards. For a list literal that is the wrong direction. It has to say what
 * its items are before the annotation is ever read, so the first item became the
 * rule and every later one was measured against its neighbour, which refuses a
 * list of records whose fields differ row by row.
 *
 * So where the surroundings said something, it is handed down, and each part is
 * checked against what the whole was declared to hold. Where they said nothing
 * the old direction stands: with no annotation the first item is still all there
 * is to go on.
 *
 * A lambda is here for the same reason and it is the sharper case. `x` in
 * `xs.map(x => …)` has no annotation anywhere and never will; the only thing
 * that knows what it holds is the call it was written inside. Handed down, the
 * body is walked knowing it. Worked out afterwards, the body has already been
 * walked against a variable that answers `dynamic` to everything.
 */

import type { Expr, ListLit, MapEntry, MapLit } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { expect, type Infer, inferExpr, inferFn } from "./infer.js";
import { emptyPour, pour, shapeOf } from "./poured-into.js";
import { DYNAMIC, list, type Type } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { fieldType, prune } from "./unify.js";

/**
 * Infer an expression knowing what the place it was written asked it to be.
 *
 * @param args The expression, the scope it is written in, and what was asked of
 * it. A `wanted` of nothing is the ordinary case and infers as it always did.
 * @returns The expression's type, recorded for hover like any other.
 */
export function inferAgainst(args: {
  expr: Expr;
  env: TypeEnv;
  infer: Infer;
  wanted?: Type;
}): Type {
  const { expr, env, infer } = args;
  const built = args.wanted ? literalAgainst({ ...args, wanted: args.wanted }) : undefined;
  if (built === undefined) return inferExpr(expr, env, infer);
  infer.types?.set(expr, built);
  return built;
}

/**
 * What an expectation reaches: the two literals with parts, and the lambda
 * whose parameters the place it was written names. Anything else has neither.
 */
function literalAgainst(args: {
  expr: Expr;
  env: TypeEnv;
  infer: Infer;
  wanted: Type;
}): Type | undefined {
  const { expr, env, infer, wanted } = args;
  if (ast.isListLit(expr)) return inferList({ ...args, expr });
  if (ast.isMapLit(expr)) return inferMap({ ...args, expr });
  if (ast.isFnExpr(expr)) return inferFn({ decl: expr, env, infer, wanted });
  return undefined;
}

/**
 * A list literal. Every item is the same type, and a `...` pours in a list of
 * that same type, which is the only thing it could pour in.
 *
 * What that type is comes from the annotation when there is one, so an item that
 * does not fit is reported where it is written and no item is the rule its
 * neighbours are held to. With nothing asked, the first item settles it, which
 * is what keeps `[1, "a"]` one mistake rather than two.
 *
 * @param args The literal, the scope, and what the elements were declared to be.
 * @returns The list type, whose element is the declared one where there was one.
 */
export function inferList(args: {
  expr: ListLit;
  env: TypeEnv;
  infer: Infer;
  wanted?: Type;
}): Type {
  const { expr, env, infer } = args;
  const element = elementAsked(args.wanted) ?? (infer.ctx.fresh() as Type);
  for (const item of expr.items) {
    const each = item.spread ? list(element) : element;
    expect(infer, item.value, inferAgainst({ expr: item.value, env, infer, wanted: each }), each);
  }
  return list(element);
}

/**
 * A map literal, field by field, with a `...` pouring another map's fields in
 * where it is written. Later wins, so a key after a spread is the one that
 * counts, and a spread of something whose shape nobody knows leaves the whole
 * literal unknown: any field could be the one it overwrote.
 *
 * What was asked of the map is not checked here, since the binding checks it
 * anyway; it is passed through to the fields, so a `list<Row>` written as the
 * value of a field is a list that knows what its rows are.
 *
 * @param args The literal, the scope, and the shape it was declared to have.
 * @returns The shape the fields build, which is what the literal actually holds.
 */
export function inferMap(args: { expr: MapLit; env: TypeEnv; infer: Infer; wanted?: Type }): Type {
  const { expr, env, infer } = args;
  const into = emptyPour();
  for (const entry of expr.entries) {
    const wanted = fieldAsked(args.wanted, entry);
    const type = inferAgainst({ expr: entry.value, env, infer, wanted });
    if (!entry.spread) into.fields.set(entry.key as string, type);
    else if (!pour(into, type)) return notAMap(entry, type, infer);
  }
  return shapeOf(into);
}

/** What a list expectation says each of its items is. */
function elementAsked(wanted: Type | undefined): Type | undefined {
  const held = wanted && prune(wanted);
  return held?.kind === "list" ? held.element : undefined;
}

/**
 * What a shape expectation says one entry holds. A `...` pours in fields the
 * shape describes, so what is asked of it is the shape itself.
 */
function fieldAsked(wanted: Type | undefined, entry: MapEntry): Type | undefined {
  const held = wanted && prune(wanted);
  if (held?.kind !== "record") return undefined;
  return entry.spread ? held : fieldType(held, entry.key as string);
}

/** A `...` of something that is not a map, said where it can still be helped. */
function notAMap(entry: MapEntry, type: Type, infer: Infer): Type {
  const held = prune(type);
  if (held.kind === "dynamic" || held.kind === "var") return DYNAMIC;
  infer.ctx.mismatches.push({
    node: entry,
    expected: held,
    actual: DYNAMIC,
    note: "is not a map, so it cannot be poured into one",
  });
  return DYNAMIC;
}
