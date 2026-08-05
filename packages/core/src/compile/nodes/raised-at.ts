import type { Expr } from "../../generated/ast.js";
import { fileOf } from "../../parse/index.js";
import { placeAt } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";

/**
 * Whatever a compiled node raised, pointed at the node that raised it.
 *
 * The node is captured while compiling and its span is read only when a throw
 * actually goes past, so an operation that never fails pays nothing for the
 * possibility. The file comes from the tree the node was parsed out of rather
 * than from whichever document happens to be running, so a failure inside an
 * imported module names that module.
 *
 * @param thrown Whatever unwound.
 * @param node The node that was being evaluated.
 * @returns The same throw, so a caller reads `throw raisedAt(thrown, node)`.
 */
export function raisedAt(thrown: unknown, node: Expr): unknown {
  placeAt(thrown, spanOf(node, fileOf(node)));
  return thrown;
}
