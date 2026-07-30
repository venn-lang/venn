import type { FnBody } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { patternNames } from "../pattern/index.js";

/**
 * Every name a `match` inside this body binds.
 *
 * They get slots like any other local: an arm's names are written before its
 * body runs, and only one arm ever runs. A `fn` written inside an arm keeps its
 * own, so the walk stops there rather than claiming names that belong to it.
 *
 * @param body The function body being compiled.
 * @returns The names, in the order the arms name them, with repeats left in.
 */
export function matchNames(body: FnBody): string[] {
  const found: string[] = [];
  for (const local of body.locals) if (local.value) walk(local.value, found);
  if (body.result) walk(body.result, found);
  return found;
}

function walk(node: object, into: string[]): void {
  if (ast.isFnExpr(node)) return;
  if (ast.isMatchExpr(node)) {
    for (const arm of node.arms) for (const one of arm.patterns) into.push(...patternNames(one));
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object") walk(child, into);
    }
  }
}
