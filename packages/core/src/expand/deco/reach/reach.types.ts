import type { Expr } from "../../../generated/ast.js";
import type { InterpolationSlot } from "../../../interpolation/index.js";
import type { Span } from "../../../problem/index.js";

/** A name a `deco` body reads, and the place it reads it from. */
export interface NameRead {
  readonly name: string;
  readonly span: Span;
}

/** One `${…}` of a string literal, as the expression it turned out to hold. */
export interface SlotExpr {
  readonly expr: Expr;
  readonly slot: InterpolationSlot;
}
