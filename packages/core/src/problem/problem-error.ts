import type { Problem } from "./problem.types.js";

/**
 * Carries a {@link Problem} across a throw boundary at runtime. Catch it to
 * recover the structured problem; `message` is only the title.
 */
export class ProblemError extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.title);
    this.name = "ProblemError";
    this.problem = problem;
  }
}
