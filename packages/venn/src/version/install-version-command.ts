import { ensureInstalled } from "./ensure-installed.js";
import type { CommandResult, VersionCommand } from "./version.types.js";

/**
 * `venn version install <range>`: put a version on the machine.
 *
 * Takes a range or a tag, so `install 0.2.x` and `install latest` both mean
 * something. A version already here is said so rather than fetched again.
 */
export async function installCommand(command: VersionCommand): CommandResult {
  const request = command.args[0];
  if (request === undefined) return usage(command);
  return (await ensureInstalled(command, request)) === undefined ? 1 : 0;
}

function usage(command: VersionCommand): number {
  command.where.say("venn version install <version|range|latest>");
  return 1;
}
