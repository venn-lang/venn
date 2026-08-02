import { walkAst } from "../../../ast/index.js";
import type { Expr, StringLit } from "../../../generated/ast.js";
import { isRef } from "../../../generated/ast.js";
import type { InterpolationSlot } from "../../../interpolation/index.js";
import type { Span } from "../../../problem/index.js";
import type { NameRead, SlotExpr } from "./reach.types.js";
import { slotExprs } from "./slot-exprs.js";

/**
 * The names read inside a string's `${…}` placeholders.
 *
 * Each is placed at its placeholder rather than at the whole string, which is
 * where an unreadable `${…}` is already reported, and is the difference between
 * pointing at a URL and pointing at the name inside it.
 *
 * @param node The string literal being read.
 * @param uri The file it was written in.
 * @returns One read per name, repeats left in: each is written somewhere.
 */
export function slotReads(node: StringLit, uri: string): NameRead[] {
  return slotExprs(node).flatMap((one) => inSlot({ one, node, uri }));
}

function inSlot(args: { one: SlotExpr; node: StringLit; uri: string }): NameRead[] {
  const span = slotSpan(args);
  return refsIn(args.one.expr).map((name) => ({ name, span }));
}

/** The root counts: `${outer}` is a name and nothing around it. */
function refsIn(expr: Expr): string[] {
  const inside = walkAst(expr).filter(isRef);
  return [...(isRef(expr) ? [expr] : []), ...inside].map((ref) => ref.name);
}

function slotSpan(args: { one: SlotExpr; node: StringLit; uri: string }): Span {
  const cst = args.node.$cstNode;
  const start = cst?.range?.start;
  const slot: InterpolationSlot = args.one.slot;
  return {
    uri: args.uri,
    offset: (cst?.offset ?? 0) + slot.start,
    length: slot.end - slot.start,
    line: (start?.line ?? 0) + 1,
    column: (start?.character ?? 0) + 1 + slot.start,
  };
}
