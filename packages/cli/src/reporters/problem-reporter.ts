import type { Problem } from "@venn-lang/core";
import { problemDetail } from "./problem-detail.js";

/**
 * Print compile-time problems to stderr: the code and title, then everything
 * else the problem knows. The terminal surface of the §16 model.
 *
 * Rendered for the stream they go to, which is this one: `2>err.txt` while the
 * report is still drawn on a terminal used to put escape codes in the file.
 *
 * @param problems What to say, in the order it was found.
 */
export function reportProblems(problems: readonly Problem[]): void {
  for (const problem of problems) {
    const detail = problemDetail(problem, { stream: process.stderr });
    process.stderr.write(`${[`${problem.code} · ${problem.title}`, ...detail].join("\n")}\n`);
  }
}
