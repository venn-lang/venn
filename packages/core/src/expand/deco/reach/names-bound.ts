import type { AstNode } from "langium";
import { walkAst } from "../../../ast/index.js";
import { PRELUDE_VALUES } from "../../../expr/index.js";
import type { DecoDecl, StringLit } from "../../../generated/ast.js";
import {
  isCaptureStmt,
  isForEachStmt,
  isLetStmt,
  isLoopStmt,
  isMatchArm,
  isParam,
  isRepeatStmt,
  isStringLit,
  isTryExpr,
  isTryStmt,
} from "../../../generated/ast.js";
import { boundNames, loopBinding, patternNames } from "../../../pattern/index.js";
import { slotExprs } from "./slot-exprs.js";

/**
 * Every name a `deco` body can read: its own parameters, whatever it binds
 * anywhere inside itself, and the prelude.
 *
 * Deliberately flat rather than scoped block by block. A name bound in one
 * closure and read from a sibling is accepted here and answers nothing at run
 * time, which is a fault this pass misses; refusing a name nothing in the body
 * accounts for is the point, and being generous is how that stays free of
 * refusals a correct decorator would trip over.
 *
 * @param decl The `deco` whose body is being read.
 * @returns The names in reach, prelude included.
 */
export function namesBound(decl: DecoDecl): Set<string> {
  const found = new Set<string>(Object.keys(PRELUDE_VALUES));
  for (const param of decl.params?.params ?? []) add(found, boundNames(param));
  for (const node of walkAst(decl.body)) {
    add(found, bindsHere(node));
    if (isStringLit(node)) add(found, inString(node));
  }
  return found;
}

/** What one node puts in scope, whichever way the grammar lets it say so. */
function bindsHere(node: AstNode): readonly string[] {
  if (isLetStmt(node) || isParam(node)) return boundNames(node);
  if (isForEachStmt(node)) return boundNames(loopBinding(node));
  if (isMatchArm(node)) return node.patterns.flatMap(patternNames);
  if (isRepeatStmt(node)) return node.index ? [node.index] : [];
  if (isLoopStmt(node)) return node.state ? [node.state.name] : [];
  if (isTryExpr(node) || isTryStmt(node)) return node.error ? [node.error] : [];
  return isCaptureStmt(node) ? [node.name] : [];
}

/** A `${…}` may hold a `fn` of its own, and its parameters are names too. */
function inString(node: StringLit): string[] {
  return slotExprs(node).flatMap((one) => walkAst(one.expr).flatMap(bindsHere));
}

function add(into: Set<string>, names: readonly string[]): void {
  for (const name of names) into.add(name);
}
