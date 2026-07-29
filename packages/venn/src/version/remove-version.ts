import {
  defaultVersion,
  installedVersions,
  resolveVersion,
  selectVersion,
  versionRoot,
} from "@venn-lang/toolchain";
import type { CommandResult, VersionCommand } from "./version.types.js";

/**
 * `venn version remove <version>`: take one off the machine.
 *
 * Refuses the version this directory is using and refuses the global default,
 * both because the alternative is leaving someone unable to run anything and
 * finding out at the next command. Removing either is still possible, by
 * pointing them somewhere else first.
 */
export async function removeCommand(command: VersionCommand): CommandResult {
  const { where } = command;
  const version = command.args[0];
  if (version === undefined) return usage(command);

  const installed = await installedVersions({ fs: where.fs, home: where.home });
  if (!installed.includes(version)) return fail(command, `${version} is not installed`);

  const held = await heldBy({ command, version, installed });
  if (held !== undefined) return fail(command, held);

  await where.fs.removeAll(versionRoot({ home: where.home, version }));
  where.say(`Removed ${version}`);
  return 0;
}

/** What is depending on this version, if anything is. */
async function heldBy(args: {
  command: VersionCommand;
  version: string;
  installed: readonly string[];
}): Promise<string | undefined> {
  const { where } = args.command;
  if ((await defaultVersion({ fs: where.fs, home: where.home })) === args.version) {
    return `${args.version} is the default. Choose another with "venn version use --global" first`;
  }
  const request = await resolveVersion({ fs: where.fs, directory: where.cwd });
  const chosen = selectVersion({ request, installed: args.installed });
  if (chosen.version === args.version && request.source !== "none") {
    return `${args.version} is what this directory uses, pinned by ${request.from}`;
  }
  return undefined;
}

function usage(command: VersionCommand): number {
  command.where.say("venn version remove <version>");
  return 1;
}

function fail(command: VersionCommand, reason: string): number {
  command.where.say(reason);
  return 1;
}
