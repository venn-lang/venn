import { installedVersions, isUsableRange, selectVersion } from "@venn-lang/toolchain";
import type { CommandResult, VersionCommand } from "./version.types.js";
import { writeDefault } from "./write-default.js";

/** The file a directory pins a version in when it is not a project. */
const VERSION_FILE = ".venn-version";

/**
 * `venn version use <range>`: pin this directory, or the machine.
 *
 * With `--global` it writes the default, which every directory that does not
 * ask falls back to. Without it, a `.venn-version` file here.
 *
 * A `venn.toml` is not edited. A manifest is under review and belongs to
 * whoever wrote it, and a command that rewrites one is a command that shows up
 * in somebody's diff unannounced. The file sits beside it and does the same
 * job, and #82 already prefers the manifest when both are there, so a project
 * that wants the pin in its manifest can put it there by hand and keep it.
 */
export async function useCommand(command: VersionCommand): CommandResult {
  const { where } = command;
  const request = command.args.find((arg) => !arg.startsWith("-"));
  if (request === undefined) return usage(command);
  if (!isUsableRange(request)) return fail(command, `${request} is not a version or a range`);

  const global = command.args.includes("--global");
  const installed = await installedVersions({ fs: where.fs, home: where.home });
  if (global) return useGlobally({ command, request, installed });

  await write(command, `${where.cwd}/${VERSION_FILE}`, request);
  where.say(`This directory now uses ${request}${noteFor({ request, installed })}`);
  return 0;
}

/**
 * The global default has to name one version rather than a range: it is the
 * answer for everything that did not ask, and an answer that moves when
 * something else is installed is not one.
 */
async function useGlobally(args: {
  command: VersionCommand;
  request: string;
  installed: readonly string[];
}): CommandResult {
  const { command, request, installed } = args;
  const chosen = selectVersion({
    request: { range: request, source: "none", from: undefined },
    installed,
  });
  if (chosen.version === undefined) {
    return fail(command, `no installed version matches ${request}. Install it first`);
  }
  await writeDefault({ where: command.where, version: chosen.version });
  command.where.say(`Now using ${chosen.version} by default`);
  return 0;
}

/** Said now rather than at the next command, which may be in a script. */
function noteFor(args: { request: string; installed: readonly string[] }): string {
  const chosen = selectVersion({
    request: { range: args.request, source: "none", from: undefined },
    installed: args.installed,
  });
  return chosen.version === undefined ? ", which is not installed yet" : "";
}

async function write(command: VersionCommand, path: string, content: string): Promise<void> {
  await command.where.fs.write(path, new TextEncoder().encode(`${content}\n`));
}

function usage(command: VersionCommand): number {
  command.where.say("venn version use <version|range> [--global]");
  return 1;
}

function fail(command: VersionCommand, reason: string): number {
  command.where.say(reason);
  return 1;
}
