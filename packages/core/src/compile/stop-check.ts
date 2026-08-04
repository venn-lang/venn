/**
 * Whether a compiled body is still allowed to run.
 *
 * A `fn` body is compiled into thunks and runs synchronously, so nothing in it
 * yields and nothing above it gets a turn: a `loop` written inside one ran to
 * the end of the world with a `@timeout` around it doing nothing at all. What
 * can stop it is a question asked at its back edges, and the answer belongs to
 * the runtime, which is the only side that knows about scopes and deadlines and
 * the one this package may not import.
 *
 * So the runtime leaves the answer here and the body asks for it. One variable
 * rather than something threaded through every frame, because a compiled body is
 * synchronous: from the boundary that installs the check to the moment that
 * statement hands control back, nothing else can be running to read it.
 *
 * The asking is on the hottest line there is. Five million passes of a loop
 * inside a `fn` took 82.5 ms with nobody answering and 96.0 ms under a
 * `@timeout`, so a scope in force costs about 2.7 ns a pass and a program
 * without one pays for a comparison against `undefined`.
 */

import type { StopCheck } from "./stop-check.types.js";

export type { StopCheck } from "./stop-check.types.js";

let check: StopCheck | undefined;

/**
 * Say who answers "should this stop?" from here on.
 *
 * Installed at every statement boundary, because that is the last moment before
 * a compiled body could start running and the first at which the scope it runs
 * under is known.
 *
 * @param next The check to ask, or `undefined` for nobody, which is what a host
 * with no notion of cancellation leaves in place.
 */
export function setStopCheck(next: StopCheck | undefined): void {
  check = next;
}

/**
 * Ask, at a loop's back edge, whether the body may go on.
 *
 * @throws Whatever the runtime says ended the scope. The value is built there
 * and only carried through here, so a timeout arrives as the `VN8001` it is
 * rather than as something this package had to invent a code for.
 */
export function stopIfTold(): void {
  const stop = check?.();
  if (stop !== undefined) throw stop;
}
