import type { Placement } from "./same-everywhere.types.js";

/**
 * The four places the same lines are written, in the order a failure reads best.
 *
 * Two of them compile the body and two interpret it, and each pair splits again:
 * a `fn` declaration owns its closure and so may hold cells, a `fn` expression
 * shares one compiled body with every closure it makes, and a `fragment` is the
 * scheduler with a call frame where the top of a file is the scheduler without
 * one.
 */
export const PLACEMENTS: readonly Placement[] = ["top", "fnDecl", "fnExpr", "fragment"];

/**
 * The whole file that writes `body` in one placement.
 *
 * `seen` is the trace: the body appends to it and the wrapper prints what it
 * ended up holding, so the assertion is that the four answers agree and nothing
 * about the body has to be predicted.
 *
 * @param placement Which wrapper to put the lines in.
 * @param body The statements under test, exactly as the case wrote them.
 * @returns Source ready to parse, importing the corpus's own `io` namespace.
 */
export function sourceFor(placement: Placement, body: string): string {
  return ['import { io } from "@t/io"', ...linesFor(placement, body)].join("\n");
}

function linesFor(placement: Placement, body: string): string[] {
  if (placement === "top") return ['let seen = ""', body, "io.print seen"];
  if (placement === "fragment") {
    return [...wrapped("fragment inside() {", body, "io.print seen"), "run inside()"];
  }
  const open = placement === "fnDecl" ? "fn inside() {" : "let inside = fn () {";
  return [...wrapped(open, body, "return seen"), "io.print inside()"];
}

function wrapped(open: string, body: string, last: string): string[] {
  return [open, 'let seen = ""', body, last, "}"];
}
