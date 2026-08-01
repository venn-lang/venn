import type { Problem } from "@venn-lang/core";
import { problemDetail } from "./problem-detail.js";

/**
 * Print compile-time problems to stderr: the code and title, then everything
 * else the problem knows. The terminal surface of the §16 model.
 */
export function reportProblems(problems: readonly Problem[]): void {
  for (const problem of problems) {
    const lines = [`${problem.code} · ${problem.title}`, ...problemDetail(problem)];
    process.stderr.write(`${lines.join("\n")}\n`);
  }
}
