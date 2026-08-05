import type { Problem } from "./problem.types.js";
import type { Thrown } from "./thrown.types.js";

/**
 * Carries a {@link Problem} across a throw boundary at runtime. Catch it to
 * recover the structured problem; `message` is only the title.
 */
export class ProblemError extends Error {
  readonly problem: Problem;
  /**
   * What the raiser attached for a program that catches this: the `data` a
   * `fail` carried, and the line it was raised on.
   *
   * Absent for every raiser that has nothing to attach, which is all of them
   * but `fail`: a problem already says where it happened, and `data` is the one
   * thing a program chose to put on a failure of its own.
   */
  readonly detail?: Thrown["detail"];

  constructor(problem: Problem, detail?: Thrown["detail"]) {
    super(problem.title);
    this.name = "ProblemError";
    this.problem = problem;
    this.detail = detail;
  }
}
