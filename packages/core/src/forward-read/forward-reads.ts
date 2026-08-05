import type { AstNode } from "langium";
import { insideAnnotation, walkAst } from "../ast/index.js";
import type { FnExpr, Ref } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { spanOf } from "../span/index.js";
import { boundBelow } from "./bound-below.js";
import type { ForwardRead } from "./forward-read.types.js";

/**
 * Every name this closure reads before the `let` below it binds it.
 *
 * Only the reads this closure makes itself. A closure written inside it answers
 * for its own, so a name read two closures deep is one refusal and not two.
 *
 * @param fn The closure, as it is written.
 * @param uri The file it was written in, for the span of each read.
 * @returns One read per name, in the order the body writes them.
 */
export function forwardReads(fn: FnExpr, uri: string): ForwardRead[] {
  return ownReads(fn)
    .filter((read) => boundBelow(read))
    .map((read) => ({ name: read.name, span: spanOf(read, uri) }));
}

/** The names this closure reads, minus those a closure inside it reads. */
function ownReads(fn: FnExpr): Ref[] {
  const found: Ref[] = [];
  for (const node of walkAst(fn)) {
    if (!ast.isRef(node) || insideAnnotation(node)) continue;
    if (closureAround(node) === fn) found.push(node);
  }
  return found;
}

/** The closure a name is read from, which is the nearest one around it. */
function closureAround(read: Ref): FnExpr | undefined {
  for (let node: AstNode | undefined = read.$container; node; node = node.$container) {
    if (ast.isFnExpr(node)) return node;
  }
  return undefined;
}
