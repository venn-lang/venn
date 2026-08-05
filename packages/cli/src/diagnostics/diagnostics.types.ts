import type { Problem } from "@venn-lang/core";

/**
 * The one list a command prints, kept for as long as that command runs.
 *
 * Stateful on purpose: a mistake found from two files is one mistake, and only
 * something outliving a single file can know that. `venn check` walked a folder
 * and said a cycle once, `venn test` walked the same folder and said it once per
 * file that led into it, and the two commands disagreed about how many problems
 * a project had.
 */
export interface Diagnostics {
  /**
   * What this command has not said yet, in reading order.
   *
   * @param problems Everything one file turned up, in whatever order its passes
   * happened to find it.
   * @returns The ones no earlier call returned, sorted by file and then by where
   * in the file they are.
   */
  unsaid(problems: readonly Problem[]): Problem[];
}
