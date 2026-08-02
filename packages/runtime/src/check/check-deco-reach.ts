import { type Document, isDecoDecl, namesOutOfReach, type Problem, walkAst } from "@venn-lang/core";
import type { CheckContext } from "./check.types.js";

/**
 * Every name a `deco` body reaches for and cannot have, said where it is
 * written.
 *
 * Expansion refuses these too, but expansion happens during a run, and by then
 * the body has already been walked: the symptom, a name reading as nothing,
 * reaches the terminal before the refusal does. `venn check` is where a person
 * finds out, so it has to know as well.
 *
 * Asked of the document rather than of each node, beside the other whole-file
 * checks. `checkInsideDeco` walks node by node and answers `[]` for anything
 * that is not a call, which is how every ordinary check is suppressed inside a
 * `deco`, and a name being read is not a call.
 */
export function checkDecoReach(document: Document, ctx: CheckContext): Problem[] {
  const found: Problem[] = [];
  for (const node of walkAst(document)) {
    if (isDecoDecl(node)) found.push(...namesOutOfReach({ decl: node, uri: ctx.uri }));
  }
  return found;
}
