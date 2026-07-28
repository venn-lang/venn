import { compileExpr } from "../compile/index.js";
import type { Expr } from "../generated/ast.js";
import type { EvalEnv } from "./eval-env.types.js";

/**
 * Evaluate a kernel expression against an injected environment.
 *
 * Compilation happens once per node and is remembered, so calling this in a
 * loop pays for the tree only on the first pass.
 *
 * @returns The value, or a promise for it when the expression reached something
 * that has not arrived yet.
 * @throws ProblemError When the expression fails: a unit mismatch, a value that
 * is not callable, or a placeholder that does not parse.
 */
export function evaluate(expr: Expr, env: EvalEnv): unknown {
  return compileExpr(expr)(env);
}
