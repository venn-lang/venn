import type { Expr } from "../generated/ast.js";

/**
 * Whether this read is where a value is going rather than where one comes from.
 *
 * The one place that answers it, asked by two: the member read, whose way out of
 * a field nobody named is different for a writer than for a reader, and the read
 * by position, which answers `T | null` to a reader and plain `T` to a writer.
 *
 * A write really is the other question. `xs[0] = 5` puts a value at a position
 * rather than finding out what is there, so the nothing a read past the end
 * answers with has nothing to do with it, and offering it would have left the
 * element type of `let xs = []` unsolved for ever: a union member is picked
 * without binding a variable, so `a | null` learns nothing from the 5.
 *
 * @param node The read, as the source wrote it.
 * @returns Whether an assignment is writing through it.
 */
export function isWritten(node: Expr): boolean {
  return node.$container?.$type === "AssignStmt" && node.$containerProperty === "target";
}
