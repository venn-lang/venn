import type { Placed, Placement } from "./same-everywhere.types.js";

const NEWLINE = String.fromCharCode(10);

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
  return placed(placement, body).source;
}

/**
 * The same file, and where in it the body sits.
 *
 * A survey of what a case writes has to tell the body from the wrapper around
 * it, and the wrappers write eleven constructs of their own. Offsets rather than
 * a search, because the body is put in here and nowhere else knows where.
 *
 * @param placement Which wrapper to put the lines in.
 * @param body The statements under test, exactly as the case wrote them.
 * @returns The source, and the half-open range the body occupies in it.
 */
export function placed(placement: Placement, body: string): Placed {
  const lines = ['import { io } from "@t/io"', ...linesFor(placement, BODY)];
  const at = lines.indexOf(BODY);
  const from = lines.slice(0, at).join(NEWLINE).length + NEWLINE.length;
  const source = [...lines.slice(0, at), body, ...lines.slice(at + 1)].join(NEWLINE);
  return { source, from, to: from + body.length };
}

/**
 * A stand-in for the body while the wrapper is built, so where it lands is
 * known rather than searched for in text the wrapper's own lines could match.
 */
const BODY = String.fromCharCode(0);

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
