import type { Problem } from "@venn-lang/core";

const LOUDNESS = ["error", "warning", "hint"];

/**
 * What stops the run, before what merely reads badly.
 *
 * A file with one error and one hint should open with the error: whoever is
 * reading wants the thing that broke, and an untidy import can wait. Stable, so
 * two of the same loudness stay in the order they were found, which is the
 * order the passes ran in.
 *
 * @param problems Everything found, in whatever order it was found.
 * @returns The same problems, errors first, hints last.
 */
export function loudestFirst(problems: readonly Problem[]): Problem[] {
  const rank = (problem: Problem): number => LOUDNESS.indexOf(problem.severity);
  return [...problems].sort((one, other) => rank(one) - rank(other));
}
