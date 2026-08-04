import type { Problem, Span } from "@venn-lang/core";
import { problemOf } from "@venn-lang/core";
import { AssertionFailed } from "./assertion-failed.js";
import type { Engine } from "./engine.types.js";
import type { FailureKind } from "./report-failure.types.js";
import { countFailure } from "./tally.js";
import type { Tally } from "./tally.types.js";

/**
 * Who is reporting a failure, so no frame ABOVE it reports the same one twice.
 *
 * Keyed on the thrown object itself rather than on a wrapper, because
 * cancellation compares a thrown reason by identity (`error === scope.stopped()`
 * in `run-parallel`): wrapping a throw on its way up would turn every cancelled
 * branch into a reported failure.
 *
 * The value is the frame that took it, because "already reported" is a question
 * about ancestry and not about the object. One rejected promise hands every
 * awaiter the SAME `Error`, so two branches of a `parallel` that both awaited
 * one dead connection are two failures: neither is above the other. `null` is a
 * claim made without a frame to compare against, which blocks everyone.
 *
 * A claim also covers one propagation rather than the object for the life of
 * the process: whoever stops the unwind gives it back through {@link release}.
 */
const claimed = new WeakMap<object, Tally | null>();

/**
 * Count a failure and put it on the stream, once.
 *
 * @param args.engine The engine of the frame that owns the failure, whose
 * emitter says which step it belongs to.
 * @param args.problem The failure, already worked out.
 * @param args.kind Which envelope: an assertion, a soft one, or anything else.
 */
export function reportProblem(args: { engine: Engine; problem: Problem; kind: FailureKind }): void {
  countFailure(args.engine);
  args.engine.emitter.emit({ kind: args.kind, data: { problem: args.problem } });
}

/**
 * Report a throw as the failure it is, where it happened.
 *
 * Called from the frame that still knows the context: the step that was running,
 * the branch that lost. Reporting there rather than at the flow boundary is what
 * keeps a step's name on its own failure, and what makes `n` collected branch
 * failures count as `n`.
 *
 * @param args.engine The engine of that frame.
 * @param args.error Whatever was thrown.
 * @param args.span Where to say it happened, if the failure does not know.
 * @returns Whether this call reported it. `false` means somebody already did,
 * or that it cannot be claimed and the flow boundary will report it instead.
 */
export function reportFailure(args: { engine: Engine; error: unknown; span: Span }): boolean {
  if (!take(args.engine, args.error)) return false;
  if (args.error instanceof AssertionFailed) {
    // Each check on the envelope an assertion travels on, so a `.all` that lost
    // four reads as four and each of them keeps the line it was written on.
    for (const one of args.error.problems) {
      reportProblem({ engine: args.engine, problem: one, kind: "expect.failed" });
    }
    return true;
  }
  const problem = problemOf({ thrown: args.error, span: args.span });
  reportProblem({ engine: args.engine, problem, kind: "failure" });
  return true;
}

/** Whether this failure still needs reporting by whoever catches it last. */
export function unclaimed(error: unknown): boolean {
  return !(isHeld(error) && claimed.has(error));
}

/**
 * Give the claim back, because this frame stopped the propagation.
 *
 * A `try` that handled it, a flow that reported it, a hook that swallowed it:
 * past any of those the failure is over, and the next throw of the same object
 * is a failure of its own rather than a repeat of this one.
 *
 * @param error Whatever was caught and taken no further.
 */
export function release(error: unknown): void {
  if (isHeld(error)) claimed.delete(error);
}

/**
 * Take responsibility for reporting this failure, so no frame above repeats it.
 *
 * A frame that reports a problem and then throws it claims the throw itself:
 * the problem is already counted and on the stream, and the throw is only how
 * the block ends. It gives the claim back through {@link release} if it later
 * decides to stop the propagation instead. Taken without a frame, so it blocks
 * every other frame rather than only the ones above: the callers that reach for
 * it are ending a block whose failures are already counted and on the stream.
 *
 * A thrown primitive cannot be tracked by identity, so it is never claimed and
 * falls to the flow boundary, which reports whatever is left. That costs it the
 * step it happened in, and only a plugin throwing a bare string can produce one.
 *
 * @param error Whatever is about to be thrown.
 * @returns Whether this call took it. `false` means it was already taken, or
 * that it cannot be.
 */
export function claim(error: unknown): boolean {
  if (!isHeld(error) || claimed.has(error)) return false;
  claimed.set(error, null);
  return true;
}

/**
 * Take it for this frame, unless a frame below this one already has it.
 *
 * The old answer was "unless anybody has it, ever", which cost a failure every
 * time two frames that are not one another's ancestors threw the same object:
 * two branches of a `parallel` awaiting one memoised rejected promise, or three
 * flows in a row calling a client that connects once. The second one reported
 * nothing, and its step closed `cancelled` over a failure it had really had.
 */
function take(engine: Engine, error: unknown): boolean {
  if (!isHeld(error) || heldBelow(error, engine.tally)) return false;
  claimed.set(error, engine.tally ?? null);
  return true;
}

/** Whether whoever holds this failure is this frame, or somewhere inside it. */
function heldBelow(error: object, mine: Tally | undefined): boolean {
  if (!claimed.has(error)) return false;
  const holder = claimed.get(error);
  // No frame to compare against, at either end: the run is above everything,
  // and a claim made without one blocks whoever is above it.
  if (!holder || !mine) return true;
  for (let at: Tally | undefined = holder; at !== undefined; at = at.parent) {
    if (at === mine) return true;
  }
  return false;
}

function isHeld(error: unknown): error is object {
  return typeof error === "object" ? error !== null : typeof error === "function";
}
