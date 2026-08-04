import { type Problem, ProblemError } from "@venn-lang/core";

/**
 * A check the program made and lost, on its way up.
 *
 * A `ProblemError`, so that `try { expect … } catch e { e.code }` binds VN6001
 * the way the specification spells an expected failure. A class of its own, so
 * the step boundary can tell it from a failure raised anywhere else: an
 * assertion ends the step it was written in, and the flow's next step is a unit
 * of work in its own right.
 *
 * It carries the checks it lost rather than leaving them reported at the line
 * they were found on, because a caught assertion is one the program handled and
 * a handled failure is not the run's. Whoever catches it last reports them, and
 * a `try` that catches it reports none.
 */
export class AssertionFailed extends ProblemError {
  /** Every check that failed: one for the plain form, `n` for `.all`. */
  readonly problems: readonly Problem[];

  constructor(problems: readonly Problem[]) {
    super(problems[0] as Problem);
    this.problems = problems;
  }
}
