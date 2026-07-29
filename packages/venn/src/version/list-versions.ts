import {
  defaultVersion,
  describe,
  installedVersions,
  resolveVersion,
  selectVersion,
} from "@venn-lang/toolchain";
import type { CommandResult, VersionCommand } from "./version.types.js";

/**
 * What is installed, and which one this directory would use.
 *
 * The reason is printed beside it, because someone asking has usually just been
 * surprised by the answer: seeing `0.2.4` explains nothing, and seeing that a
 * `venn.toml` two directories up asked for `0.2.x` ends the question.
 */
export async function listVersions(command: VersionCommand): CommandResult {
  const { where } = command;
  const installed = await installedVersions({ fs: where.fs, home: where.home });
  if (installed.length === 0) {
    where.say("No versions installed. The next command will fetch one.");
    return 0;
  }
  const chosen = await inUse(command, installed);
  for (const version of [...installed].sort(byNewest)) {
    where.say(version === chosen?.version ? `* ${version}` : `  ${version}`);
  }
  if (chosen) where.say(`\nUsing ${describe(chosen)}`);
  return 0;
}

/** What a command run here right now would end up on. */
async function inUse(command: VersionCommand, installed: readonly string[]) {
  const { where } = command;
  const request = await resolveVersion({
    fs: where.fs,
    directory: where.cwd,
    defaultVersion: await defaultVersion({ fs: where.fs, home: where.home }),
  });
  return selectVersion({ request, installed });
}

/** Newest first, since that is the one most people are looking for. */
function byNewest(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true });
}
