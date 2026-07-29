import type { Release } from "@venn-lang/toolchain";
import {
  catalogueOf,
  installedVersions,
  installVersion,
  nothingPublishedFor,
  releaseFor,
} from "@venn-lang/toolchain";
import type { VersionCommand } from "./version.types.js";

/**
 * Puts a version on the machine and says which one that was.
 *
 * Shared by `install` and `upgrade`, which differ in what they do afterwards
 * rather than in how they fetch. Anything that goes wrong is reported here, so
 * a caller that gets nothing back has nothing left to explain.
 *
 * @param command The surroundings, and the range or tag to resolve.
 * @param request A version, a range, or `latest`.
 * @returns The version now installed, or nothing when it could not be.
 */
export async function ensureInstalled(
  command: VersionCommand,
  request: string,
): Promise<string | undefined> {
  const release = await offered(command, request);
  if (release === undefined) return undefined;
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

async function fetch(command: VersionCommand, release: Release): Promise<string> {
  const { where } = command;
  const installed = await installedVersions({ fs: where.fs, home: where.home });
  if (installed.includes(release.version)) {
    where.say(`${release.version} is already installed`);
    return release.version;
  }
  where.say(`Installing ${release.version}`);
  const into = `${where.home}/versions`;
  await installVersion({ fs: where.fs, release, into, fetchBytes: where.fetchBytes });
  where.say(`Installed ${release.version}`);
  return release.version;
}
