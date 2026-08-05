import { applyBinary } from "../../expr/index.js";
import type { Expr } from "../../generated/ast.js";
import type { SlowBinary } from "./binary-slow.types.js";
import { raisedAt } from "./raised-at.js";

/**
 * The general operator path for one node, told where that node was written.
 *
 * Built once while compiling, so the node is captured rather than looked up.
 * The handler lives here and not in the thunk on purpose: two plain numbers
 * return before this is ever called, so the arithmetic every program does pays
 * nothing, and the thunk V8 optimises stays a thunk with no handler in it.
 *
 * @param op The operator, as it was written.
 * @param node The whole operation, which is what a reader is shown.
 * @returns The operation over two values that are not both plain numbers.
 * @throws {ProblemError} Whatever the operator raised, now placed.
 */
export function slowBinary(op: string, node: Expr): SlowBinary {
  return (left, right) => {
    try {
      return applyBinary(op, left, right);
    } catch (thrown) {
      throw raisedAt(thrown, node);
    }
  };
}
