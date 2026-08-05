import type { Problem } from "@venn-lang/core";

/**
 * Whether a problem is one that stops what the command was doing.
 *
 * A hint is something worth saying and not something worth stopping for: an
 * import nobody used is untidy, not wrong, and a check that fails on it is a
 * check people stop running. `venn build` reads the same rule, so a file that
 * checks clean does not fail the release path over an untidy import.
 *
 * Severity decides whether a run stops. It never decides whether a problem is
 * printed: every command prints every problem it found, because a program that
 * runs clean and fails `venn check` is two compilers wearing one name.
 */
export function isError(problem: Problem): boolean {
  return problem.severity === "error";
}

/**
 * Whether this list refuses the file.
 *
 * The question every caller of `runFile` used to ask as `problems.length > 0`,
 * back when the outcome carried nothing but errors.
 */
export function refuses(problems: readonly Problem[]): boolean {
  return problems.some(isError);
}
