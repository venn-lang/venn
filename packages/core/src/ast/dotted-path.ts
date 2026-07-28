import type { AstNode } from "langium";
import type { Expr } from "../generated/ast.js";
import { isMember, isRef } from "../generated/ast.js";

/**
 * The dotted name an expression spells, such as `http.get` or
 * `data.faker.uuid`.
 *
 * The parser cannot tell a namespace from a field: `res.status` and `http.get`
 * are the same shape. Only a registry knows which is which, so the name is
 * carried this far as text and asked about there.
 *
 * @returns The dotted name, or `undefined` when the expression is not a plain
 *   chain of identifiers.
 */
export function dottedPath(expr: Expr | AstNode | undefined): string | undefined {
  if (!expr) return undefined;
  if (isRef(expr)) return expr.name;
  if (!isMember(expr) || expr.optional) return undefined;
  const receiver = dottedPath(expr.receiver);
  return receiver === undefined ? undefined : `${receiver}.${expr.member}`;
}
