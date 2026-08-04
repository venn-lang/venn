import type { EventSink } from "@venn-lang/runtime";
import { failureIn } from "./failure-kinds.js";
import { reportProblems } from "./problem-reporter.js";

/**
 * The sink for a run with no reporter watching it: `venn run` leaves stdout to
 * the program, so nothing draws its flows.
 *
 * Failures are the exception. A `setup` that blew up is counted rather than
 * thrown, so this is the only place it can still be said out loud, on stderr,
 * where the program's own output is not. All three failure envelopes, since a
 * verb that threw is no more silent than an assertion that lost.
 *
 * @returns A sink that reports failures to stderr and ignores everything else.
 */
export function createProblemSink(): EventSink {
  return {
    emit: (envelope) => {
      const problem = failureIn(envelope);
      if (problem) reportProblems([problem]);
    },
  };
}
