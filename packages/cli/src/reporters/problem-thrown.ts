import { VennError } from "@venn-lang/contracts";
import { docsFor, type Problem, problemOf, type Thrown, UNLOCATED } from "@venn-lang/core";

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
 * A code the language catalogued is recognised whichever copy of the class
 * built the failure, because `instanceof` alone was not enough.
 * `@venn-lang/contracts` ships `.` and `./node` as two separate bundles, so the
 * binary holds two `VennError` classes and one raised through the node side is
 * not an instance of the class imported here. That is how a missing file
 * reached the terminal as `File not found: "x".` with its `VN8010` stripped
 * off, while `json.parse` beside it kept `VN7003`. `docsFor` is the language's
 * one owner of what a code of ours looks like, so asking it makes the same
 * claim without naming a class. Nothing under vitest can see any of this: the
 * `development` condition resolves both entries to `src`, where there is one
 * module and one class.
 *
 * Everything else is a stray from below the language: an `ENOENT`, a `TypeError`,
 * a `RangeError` about a call stack. Those have no code of ours to lead with and
 * are said as the one line they are. An `ENOENT` carries a `code` too, which is
 * why the question asked is whether it is one of ours rather than whether there
 * is one at all.
 *
 * @param error Whatever was thrown.
 * @returns Its problem, or `undefined` when nothing below vouched for a code.
 */
export function problemThrown(error: unknown): Problem | undefined {
  const held = error as Thrown | undefined;
  const catalogued = held?.code !== undefined && docsFor(held.code) !== undefined;
  if (!held?.problem && !catalogued && !(error instanceof VennError)) return undefined;
  // Nobody below named a line, and inventing the file's first one would point a
  // reader at code that is not the code that failed.
  return problemOf({ thrown: error, span: UNLOCATED });
}
