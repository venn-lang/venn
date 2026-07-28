import type { Problem } from "@venn-lang/core";
import type { EventSink } from "@venn-lang/runtime";
import { reportProblems } from "./problem-reporter.js";

/**
 * The sink for a run with no reporter watching it: `venn run` leaves stdout to
 * the program, so nothing draws its flows.
 *
 * Failures are the exception. A `setup` that blew up is counted rather than
 * thrown, so this is the only place it can still be said out loud, on stderr,
 * where the program's own output is not.
 */
export function createProblemSink(): EventSink {
  return {
    emit: (envelope) => {
      if (envelope.kind !== "expect.failed") return;
      reportProblems([(envelope.data as { problem: Problem }).problem]);
    },
  };
}
