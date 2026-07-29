import type { Surroundings } from "../execute.js";
import { installCommand } from "./install-version-command.js";
import { listVersions } from "./list-versions.js";
import { removeCommand } from "./remove-version.js";
import { useCommand } from "./use-version.js";
import type { CommandResult, VersionCommand } from "./version.types.js";

const COMMANDS: Readonly<Record<string, (command: VersionCommand) => CommandResult>> = {
  install: installCommand,
  list: listVersions,
  use: useCommand,
  remove: removeCommand,
};

/**
 * `venn version …`: the commands the orchestrator answers itself.
 *
 * Everything else `venn` is given goes to the language untouched, so `venn
 * install` and `venn remove` keep meaning dependencies and nothing a project
 * already scripts changes.
 *
 * @returns The exit code, or nothing when this is not a `version` command and
 * should be handed over like anything else.
 */
export async function versionCommand(args: {
  argv: readonly string[];
  where: Surroundings;
}): Promise<number | undefined> {
  if (args.argv[0] !== "version") return undefined;
  const name = args.argv[1];
  const run = name === undefined ? undefined : COMMANDS[name];
  if (run === undefined) return usage(args.where);
  return run({ where: args.where, args: args.argv.slice(2) });
}

function usage(where: Surroundings): number {
  where.say("venn version install <version|range|latest>");
  where.say("venn version list");
  where.say("venn version use <version|range> [--global]");
  where.say("venn version remove <version>");
  return 1;
}
