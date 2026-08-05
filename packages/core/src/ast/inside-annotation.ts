import type { AstNode } from "langium";
import { isAnnotation } from "../generated/ast.js";

/**
 * Whether a node is written inside a `@name(…)`.
 *
 * A bare name there is a word, not a reference: `@tags(smoke)` names a tag and
 * `@scope(worker)` names a lifetime. Decorators run before the program exists,
 * so there is nothing yet for one to refer to, and the expander reads a `Ref`
 * there as its own text rather than looking it up. A string there is decorator
 * arguments rather than code, for the same reason.
 *
 * Every check that reports an unbound name, an unreadable placeholder or a
 * name a `deco` body reads has to skip these, and three of them used to decide
 * it for themselves.
 *
 * @param node Any node.
 * @returns True when an `Annotation` encloses it. The node itself is not
 * examined: an annotation is not written inside itself.
 */
export function insideAnnotation(node: AstNode): boolean {
  for (let at = node.$container; at; at = at.$container) if (isAnnotation(at)) return true;
  return false;
}
