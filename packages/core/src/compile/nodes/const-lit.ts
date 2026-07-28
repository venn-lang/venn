import type { Expr } from "../../generated/ast.js";
import type { Thunk } from "../compile.types.js";
import { constant } from "./literal.js";

/** A value standing where an expression was. Only expansion ever writes one. */
interface ConstLit {
  $type: "ConstLit";
  value: unknown;
}

const CONST_LIT = "ConstLit";

/**
 * Wrap a value as an expression node.
 *
 * A decorator's `.setValue` binds a value, and the grammar has no node that
 * holds one: every literal it produces is text still to be read. Expansion
 * writes this instead, so a changed binding is a change to the tree itself
 * rather than to a lookup table kept beside it.
 */
export function constLit(value: unknown): Expr {
  return { $type: CONST_LIT, value } as unknown as Expr;
}

/** The thunk for a node expansion put there, or nothing for anything else. */
export function constThunk(expr: unknown): Thunk | undefined {
  const written = expr as ConstLit | undefined;
  if (written?.$type !== CONST_LIT) return undefined;
  return constant(written.value);
}
