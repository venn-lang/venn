import type { FileSystem } from "@venn-lang/contracts";
import type { FetchBytes, FetchJson, Release } from "@venn-lang/toolchain";
import {
  catalogueOf,
  entryOf,
  installVersion,
  nothingPublishedFor,
  planFor,
  releaseFor,
} from "@venn-lang/toolchain";
import { upgradeCommand, versionCommand } from "./version/index.js";

/**
 * Everything the orchestrator touches outside itself.
 *
 * Passed in rather than reached for, so what it decides can be exercised
 * without a disk, a network or a subprocess. `run` is the one place that builds
 * the real one.
 */
export interface Surroundings {
  readonly fs: FileSystem;
  /** Where versions live. */
  readonly home: string;
  /** The directory the command was run from. */
  readonly cwd: string;
  readonly fetchJson: FetchJson;
  readonly fetchBytes: FetchBytes;
  /** Runs the language and gives back its exit code. */
  readonly handOver: (args: { entry: string; args: readonly string[] }) => Promise<number>;
  /**
   * Where a note about installing goes. Standard error, since a command whose
   * output is piped somewhere should not have a line about fetching a compiler
   * appear in the middle of it.
   */
  readonly say: (line: string) => void;
}

/**
 * What `venn <anything>` does: work out which version this directory wants,
 * fetch it if it is not here, and hand the command over.
 *
 * @param argv Everything after the binary name, passed through untouched.
 * @returns The exit code to leave with.
 */
export async function execute(args: {
  argv: readonly string[];
  where: Surroundings;
}): Promise<number> {
  const { where } = args;
  const own = (await versionCommand(args)) ?? (await upgradeCommand(args));
  if (own !== undefined) return own;
  const plan = await planFor({ fs: where.fs, home: where.home, directory: where.cwd });
  if (plan.kind === "stop") return refuse(where, plan.reason);
  if (plan.kind === "run") return where.handOver({ entry: plan.entry, args: args.argv });

  const version = await fetch({ where, request: plan.request, reason: plan.reason });
  if (version === undefined) return 1;
  const entry = await entryOf({ fs: where.fs, home: where.home, version, kind: "run" });
  if (entry === undefined) return refuse(where, `${version} installed but offers nothing to run`);
  return where.handOver({ entry, args: args.argv });
}

async function fetch(args: {
  where: Surroundings;
  request: string;
  reason: string;
}): Promise<string | undefined> {
  const release = await offered(args);
  if (release === undefined) return undefined;
  args.where.say(`venn: installing ${release.version}`);
  await installVersion({
    fs: args.where.fs,
    release,
    into: `${args.where.home}/versions`,
    fetchBytes: args.where.fetchBytes,
  });
  return release.version;
}

/** What the registry has for this request, or nothing and a reason why. */
async function offered(args: {
  where: Surroundings;
  request: string;
  reason: string;
}): Promise<Release | undefined> {
  const { where, request } = args;
  const catalogue = await catalogueOf({ fetchJson: where.fetchJson }).catch(() => undefined);
  if (catalogue === undefined) {
    return said(where, `${args.reason}, and the registry could not be reached`);
  }
  return (
    releaseFor({ catalogue, request }) ?? said(where, nothingPublishedFor({ catalogue, request }))
  );
}

/** Says why, and gives back the code a failure leaves with. */
function refuse(where: Surroundings, reason: string): number {
  where.say(`venn: ${reason}`);
  return 1;
}

/** Says why, and gives back nothing, which the caller reads as a failure. */
function said(where: Surroundings, reason: string): undefined {
  where.say(`venn: ${reason}`);
  return undefined;
}
