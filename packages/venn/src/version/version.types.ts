import type { Surroundings } from "../execute.js";

/** What a `venn version` subcommand needs, and where it writes. */
export interface VersionCommand {
  readonly where: Surroundings;
  /** Everything after `venn version <name>`. */
  readonly args: readonly string[];
}

/** How a subcommand ended: the exit code to leave with. */
export type CommandResult = Promise<number>;
