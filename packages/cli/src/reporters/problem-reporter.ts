import type { Problem } from "@venn-lang/core";

/**
 * Print compile-time problems to stderr, one code and title per problem with
 * its source location beneath. The terminal surface of the §16 model.
 */
export function reportProblems(problems: readonly Problem[]): void {
  for (const problem of problems) {
    process.stderr.write(`${problem.code} · ${problem.title}\n`);
    const { uri, line, column } = problem.span;
    process.stderr.write(`  at ${uri}:${line}:${column}\n`);
  }
}
