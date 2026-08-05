/**
 * `+` between strings, which the checker knew about and did not say.
 *
 * What it used to report was the two types, twice, because `+` expected a number
 * of each side in turn; and where the result was bound to a string, a third line
 * saying the opposite. Three positions, one column, nothing about joining.
 *
 * The sentence itself lives in `problem/joined-with-plus.ts`, because the parse
 * recovery reaches the same mistake from `print "a" + "b"`, which never parses,
 * and the two must not drift.
 */

import { CODES } from "../codes/index.js";
import type { Binary, Expr } from "../generated/ast.js";
import { isBinary } from "../generated/ast.js";
import { JOINED_WITH_PLUS, joinInstead } from "../problem/index.js";
import { slotOrigin } from "../span/index.js";
import type { TypeMismatch } from "./context.js";
import { STRING, type Type } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * Whether this `+` is joining rather than adding.
 *
 * One string is enough. `"total: " + n` is the same reach for concatenation as
 * `a + b` is, and answering it with `expected number, found string` describes
 * the operator's appetite rather than the reader's intent.
 *
 * @param op The operator written.
 * @param left The left operand's type.
 * @param right The right operand's type.
 * @returns True when the reader meant to join text.
 */
export function joinsStrings(op: string, left: Type, right: Type): boolean {
  return op === "+" && (isText(left) || isText(right));
}

/** A string, however it was written: the type, or one value of it. */
function isText(type: Type): boolean {
  const t = prune(type);
  if (t.kind === "prim") return t.name === "string";
  return t.kind === "literal" && typeof t.value === "string";
}

/**
 * Whether an outer `+` will say it for this one.
 *
 * `"a" + "b" + "c"` is one mistake written twice, and the outermost `+` is the
 * only node that can see every piece, so it is the one that speaks. Brackets
 * make no node here, so `"a" + ("b" + "c")` is the same chain and is answered
 * the same way.
 */
export function insideAJoin(expr: Binary): boolean {
  const up = expr.$container;
  return isBinary(up) && up.operator === "+";
}

/**
 * What to report, once, for the whole chain.
 *
 * @param expr The outermost `+` of the chain.
 * @returns The mismatch, carrying the sentence and the line to write instead.
 */
export function joinedWithPlus(expr: Binary): TypeMismatch {
  return {
    node: expr,
    expected: STRING,
    actual: STRING,
    code: CODES.VN3024_JOINED_WITH_PLUS,
    sentence: JOINED_WITH_PLUS,
    help: joinInstead(operands(expr).map(writtenAs), slotOrigin(expr) !== undefined),
  };
}

/** Every piece of a `+` chain, in reading order. */
function operands(expr: Binary): Expr[] {
  const left =
    isBinary(expr.left) && expr.left.operator === "+" ? operands(expr.left) : [expr.left];
  const right =
    isBinary(expr.right) && expr.right.operator === "+" ? operands(expr.right) : [expr.right];
  return [...left, ...right];
}

/** An operand exactly as the source spelled it, which is what to hand back. */
function writtenAs(expr: Expr): string {
  return expr.$cstNode?.text ?? "";
}
