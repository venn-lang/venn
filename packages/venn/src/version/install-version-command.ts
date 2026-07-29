import type { Release } from "@venn-lang/toolchain";
import {
  catalogueOf,
  installedVersions,
  installVersion,
  nothingPublishedFor,
  releaseFor,
} from "@venn-lang/toolchain";
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
  const release = await offered(command, request);
  if (release === undefined) return 1;
  return fetch(command, release);
}

/** What the registry has for this request, having said why when it has none. */
async function offered(command: VersionCommand, request: string): Promise<Release | undefined> {
  const { where } = command;
  const catalogue = await catalogueOf({ fetchJson: where.fetchJson }).catch(() => undefined);
  if (catalogue === undefined) {
    where.say("the registry could not be reached");
    return undefined;
  }
  const release = releaseFor({ catalogue, request });
  if (release === undefined) where.say(nothingPublishedFor({ catalogue, request }));
  return release;
}

async function fetch(command: VersionCommand, release: Release): CommandResult {
  const { where } = command;
  const installed = await installedVersions({ fs: where.fs, home: where.home });
  if (installed.includes(release.version)) {
    where.say(`${release.version} is already installed`);
    return 0;
  }
  where.say(`Installing ${release.version}`);
  const into = `${where.home}/versions`;
  await installVersion({ fs: where.fs, release, into, fetchBytes: where.fetchBytes });
  where.say(`Installed ${release.version}`);
  return 0;
}

function usage(command: VersionCommand): number {
  command.where.say("venn version install <version|range|latest>");
  return 1;
}
