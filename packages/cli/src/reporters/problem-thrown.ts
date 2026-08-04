import { VennError } from "@venn-lang/contracts";
import { type Problem, problemOf, type Thrown } from "@venn-lang/core";

/**
 * Nobody below named a line. `problemLines` prints no location for a span with no
 * uri, which is the truth here: inventing the file's first line would point a
 * reader at code that is not the code that failed.
 */
const NO_SPAN = { uri: "", offset: 0, length: 0, line: 1, column: 1 };

/**
 * The failure a throw carries, when it carries one the language catalogued.
 *
 * A `ProblemError` holds a whole problem and a `VennError` holds a code, a
 * message and sometimes a span in `detail.where`, and both were reaching the
 * terminal as a bare line: `VN2003  Unknown action "s.nope".` with no location
 * and no help, beside a `ProblemError` printing `VN3010 · title`, so one
 * command's stderr carried two formats for the same kind of failure. The
 * conversion is `problemOf`, once, so the CLI keeps no second idea of what a
 * thrown failure is.
 *
 * Everything else is a stray from below the language: an `ENOENT`, a `TypeError`,
 * a `RangeError` about a call stack. Those have no code of ours to lead with and
 * are said as the one line they are.
 *
 * @param error Whatever was thrown.
 * @returns Its problem, or `undefined` when nothing below vouched for a code.
 */
export function problemThrown(error: unknown): Problem | undefined {
  const held = error as Thrown | undefined;
  if (!held?.problem && !(error instanceof VennError)) return undefined;
  return problemOf({ thrown: error, span: NO_SPAN });
}
