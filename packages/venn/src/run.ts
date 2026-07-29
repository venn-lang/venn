import { homedir } from "node:os";
import { createNodeFs } from "@venn-lang/contracts/node";
import {
  catalogueOf,
  createFetchBytes,
  createFetchJson,
  entryOf,
  installVersion,
  nothingPublishedFor,
  planFor,
  releaseFor,
  vennHome,
} from "@venn-lang/toolchain";
import { handOver } from "./hand-over.js";

/**
 * What `venn <anything>` does: work out which version this directory wants,
 * fetch it if it is not here, and hand the command over.
 *
 * @param argv Everything after the binary name.
 * @returns The exit code to leave with.
 */
export async function run(argv: readonly string[]): Promise<number> {
  const fs = createNodeFs();
  const home = vennHome({ env: process.env, home: homedir() });
  const plan = await planFor({ fs, home, directory: process.cwd() });

  if (plan.kind === "stop") return fail(plan.reason);
  if (plan.kind === "run") return handOver({ entry: plan.entry, args: argv });

  const version = await fetch({ fs, home, request: plan.request, reason: plan.reason });
  if (version === undefined) return 1;
  const entry = await entryOf({ fs, home, version, kind: "run" });
  if (entry === undefined) return fail(`${version} installed but offers nothing to run`);
  return handOver({ entry, args: argv });
}

/**
 * Fetches a version, saying so first.
 *
 * The message goes to standard error rather than standard output: a command
 * whose output is being piped somewhere should not have a line about installing
 * a compiler appear in the middle of it.
 */
async function fetch(args: {
  fs: ReturnType<typeof createNodeFs>;
  home: string;
  request: string;
  reason: string;
}): Promise<string | undefined> {
  const catalogue = await catalogueOf({ fetchJson: createFetchJson() }).catch(() => undefined);
  if (catalogue === undefined) return note(`${args.reason}, and the registry could not be reached`);
  const release = releaseFor({ catalogue, request: args.request });
  if (release === undefined) return note(nothingPublishedFor({ catalogue, request: args.request }));

  process.stderr.write(`venn: installing ${release.version}\n`);
  await installVersion({
    fs: args.fs,
    release,
    into: `${args.home}/versions`,
    fetchBytes: createFetchBytes(),
  });
  return release.version;
}

function note(reason: string): undefined {
  process.stderr.write(`venn: ${reason}\n`);
  return undefined;
}

function fail(reason: string): number {
  process.stderr.write(`venn: ${reason}\n`);
  return 1;
}
