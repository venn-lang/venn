import { homedir } from "node:os";
import type { FileSystem } from "@venn-lang/contracts";
import { createNodeFs } from "@venn-lang/contracts/node";
import type { FetchBytes, FetchJson } from "@venn-lang/toolchain";
import {
  catalogueOf,
  createFetchBytes,
  createFetchJson,
  installedVersions,
  installVersion,
  releaseFor,
  vennHome,
} from "@venn-lang/toolchain";

/** What preparing touches, passed in so it can be exercised without any of it. */
export interface Preparation {
  readonly fs: FileSystem;
  readonly home: string;
  readonly fetchJson: FetchJson;
  readonly fetchBytes: FetchBytes;
  readonly say: (line: string) => void;
}

/**
 * Fetches the newest version, so the first command does not have to wait.
 *
 * Run from `postinstall`, and entirely an optimisation: nothing depends on it
 * having happened. `--ignore-scripts` is ordinary practice, and this repository
 * uses it in five places of its own CI, so anything that needed a postinstall
 * to have run would not work. A missing version installs itself when a command
 * needs one.
 *
 * Which is why nothing here throws. A registry that cannot be reached during
 * `npm install` is not a reason for the install to fail: the language arrives
 * on first use instead, a few seconds later, once.
 */
export async function prepare(where: Preparation): Promise<void> {
  try {
    await fetchNewest(where);
  } catch {
    where.say("venn: the language will be fetched on first use");
  }
}

async function fetchNewest(where: Preparation): Promise<void> {
  if ((await installedVersions(where)).length > 0) return;
  const catalogue = await catalogueOf({ fetchJson: where.fetchJson });
  const release = releaseFor({ catalogue, request: "latest" });
  if (release === undefined) return;
  await installVersion({
    fs: where.fs,
    release,
    into: `${where.home}/versions`,
    fetchBytes: where.fetchBytes,
  });
  where.say(`venn: ${release.version} ready`);
}

/** The real ones, for the postinstall to use. */
export function realPreparation(): Preparation {
  return {
    fs: createNodeFs(),
    home: vennHome({ env: process.env, home: homedir() }),
    fetchJson: createFetchJson(),
    fetchBytes: createFetchBytes(),
    say: (line) => {
      process.stderr.write(`${line}\n`);
    },
  };
}
