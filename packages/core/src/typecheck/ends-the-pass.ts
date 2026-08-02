/**
 * Whether control ever reaches the statement written after this one.
 *
 * A guard clause is an `if` nobody falls out of, and everything below it runs
 * only when the condition did not hold. Narrowing has to know that, or the flat
 * way of writing a function is refused while the nested way is allowed.
 */

import type { Block, IfStmt, Statement } from "../generated/ast.js";
import * as ast from "../generated/ast.js";

/** The verb that ends the pass without being a keyword: `fail "no status"`. */
const FAILS = "fail";

/**
 * Whether every path through a branch leaves the block it sits in.
 *
 * @param node A block, or one branch of an `if`, which may be another `if`.
 * @returns True when nothing written after it can run: it returns, fails,
 * breaks or continues on every path.
 */
export function endsThePass(node: Block | IfStmt): boolean {
  if (ast.isIfStmt(node)) return bothBranchesEnd(node);
  return node.stmts.some(statementEnds);
}

/** An `if` ends the pass only when it has an `else` and both sides end it. */
function bothBranchesEnd(node: IfStmt): boolean {
  if (!node.otherwise) return false;
  return endsThePass(node.then) && endsThePass(node.otherwise);
}

function statementEnds(stmt: Statement): boolean {
  if (ast.isReturnStmt(stmt) || ast.isBreakStmt(stmt) || ast.isContinueStmt(stmt)) return true;
  if (ast.isIfStmt(stmt)) return bothBranchesEnd(stmt);
  return ast.isActionCall(stmt) && stmt.target === FAILS;
}
