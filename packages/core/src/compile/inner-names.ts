import type { FnBody } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { patternNames } from "../pattern/index.js";

/**
 * Every name an expression inside this body binds: a `match` arm's pattern, and
 * what a `try … catch e =>` calls the failure.
 *
 * They get slots like any other local. An arm's names are written before its
 * body runs and only one arm ever runs, and a `catch` name is written only where
 * the attempt failed, so repeats meet in one slot without ever meeting in time.
 * A `fn` written inside one keeps its own, so the walk stops there rather than
 * claiming names that belong to it.
 *
 * @param body The function body being compiled.
 * @returns The names, in the order they are named, with repeats left in.
 */
export function innerNames(body: FnBody): string[] {
  const found: string[] = [];
  for (const stmt of body.stmts) walk(stmt, found);
  if (body.result) walk(body.result, found);
  return found;
}

function walk(node: object, into: string[]): void {
  if (ast.isFnExpr(node)) return;
  if (ast.isMatchExpr(node)) {
    for (const arm of node.arms) for (const one of arm.patterns) into.push(...patternNames(one));
  }
  if (ast.isTryExpr(node) && node.error) into.push(node.error);
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object") walk(child, into);
    }
  }
}
