import { shownColumn } from "../lang/index.js";
import type { SpanNode } from "./span.types.js";

/**
 * The 1-based line and column of a CST node, as a reader sees them.
 *
 * A byte-order mark is a character the file has and no editor draws, so the
 * offset beside these counts it and the column does not: an offset is what the
 * editor turns back into a position against the text it has open, mark and all,
 * and a column is what a person reads beside a file name. The whole file hangs
 * off every node, which is what says whether one opens it.
 *
 * Done here rather than in the lexer, where the mark's column used to be taken
 * off the token itself: Langium builds `$cstNode.range` out of those columns and
 * `$cstNode.offset` out of the offsets, and every LSP surface reads the range,
 * so a token shifted for the sake of a report made rename rewrite the wrong
 * characters.
 *
 * @param cst The node's CST, or nothing when it has none.
 * @returns The line, and the column with any mark taken back off.
 */
export function shownPlace(cst: SpanNode["$cstNode"]): { line: number; column: number } {
  const start = cst?.range?.start;
  const line = (start?.line ?? 0) + 1;
  const column = (start?.character ?? 0) + 1;
  return { line, column: shownColumn({ text: cst?.root?.fullText ?? "", line, column }) };
}
