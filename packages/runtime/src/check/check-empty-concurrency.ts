import {
  type AstNode,
  buildProblem,
  CODES,
  isParallelStmt,
  isRaceStmt,
  type ParallelStmt,
  type Problem,
  type RaceStmt,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * `race { }` or `parallel { }` with nothing between the braces.
 *
 * An empty `race` used to be the quietest failure in the language: it could
 * never settle, so everything after it was deleted from the run, no verdict was
 * reached and the process left with 0. That is now caught at the statement, but
 * a block with no branches is a half-written one either way, and saying so
 * before anything runs is what points at the line rather than at the silence.
 */
export function checkEmptyConcurrency(node: AstNode, ctx: CheckContext): Problem[] {
  const block =
    isRaceStmt(node) || isParallelStmt(node) ? (node as RaceStmt | ParallelStmt) : undefined;
  if (!block || block.body.stmts.length > 0) return [];
  return [
    {
      ...buildProblem({
        spec: CODES.VN4001_NOTHING_TO_RUN,
        span: nodeSpan(block, ctx.uri),
        title: `This ${word(block)} has no branches, so there is nothing for it to run.`,
      }),
      help: "Write the branches inside it, or take the block out.",
    },
  ];
}

function word(block: RaceStmt | ParallelStmt): string {
  return isRaceStmt(block) ? "race" : "parallel";
}
