import type { RunResult } from "@venn/runtime";

/**
 * The number a run hands to the process.
 *
 * `exit 3` is the program saying how it went, and nothing here knows better,
 * `exit 0` after a failure included. Without one, a run that reported failures
 * must not leave with 0: a `setup` that blew up is counted rather than thrown,
 * and a 0 would tell whatever is waiting on this process that the program did
 * its job.
 */
export function exitCodeOf(result: RunResult | undefined): number {
  if (result?.exitCode !== undefined) return result.exitCode;
  return result && result.failed > 0 ? 1 : 0;
}
