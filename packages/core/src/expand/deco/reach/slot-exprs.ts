import type { StringLit } from "../../../generated/ast.js";
import type { InterpolationSlot } from "../../../interpolation/index.js";
import { scanInterpolations } from "../../../interpolation/index.js";
import { parseExpression } from "../../../parse/index.js";
import type { SlotExpr } from "./reach.types.js";

/**
 * Every `${…}` in a string literal that reads as an expression.
 *
 * A placeholder is text until something parses it, and both halves of the reach
 * question are asked of what it holds: the names it binds and the names it
 * reads. One that does not parse is left out, since `venn check` already refuses
 * it at the placeholder and a second vocabulary for it would help nobody.
 *
 * @param node The string literal, taken from its own source text.
 * @returns One entry per readable placeholder, in the order they appear.
 */
export function slotExprs(node: StringLit): SlotExpr[] {
  const text = node.$cstNode?.text;
  if (!text) return [];
  return scanInterpolations(text).flatMap(withExpr);
}

function withExpr(slot: InterpolationSlot): SlotExpr[] {
  const expr = parseExpression(slot.source);
  return expr ? [{ expr, slot }] : [];
}
