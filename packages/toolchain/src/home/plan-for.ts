import type { FileSystem } from "@venn-lang/contracts";
import { describe, resolveVersion, selectVersion, type VersionRequest } from "../resolve/index.js";
import { entryOf } from "./entry-of.js";
import type { EntryKind, Plan } from "./home.types.js";
import { defaultVersion, installedVersions } from "./venn-home.js";

/**
 * What to do about a directory: run something, install something, or stop.
 *
 * The whole decision in one place, so the orchestrator holds no policy of its
 * own and a test can ask what would happen without anything happening.
 *
 * @param fs Where to look.
 * @param home Where the versions live, from `vennHome`.
 * @param directory The working directory.
 * @param kind Which entry point is wanted: the language, or its server.
 */
export async function planFor(args: {
  fs: FileSystem;
  home: string;
  directory: string;
  kind?: EntryKind;
}): Promise<Plan> {
  const request = await resolveVersion({
    fs: args.fs,
    directory: args.directory,
    defaultVersion: await defaultVersion(args),
  });
  const choice = selectVersion({ request, installed: await installedVersions(args) });
  if (choice.version === undefined) return missing({ request, reason: describe(choice) });
  return handOverTo({ ...args, version: choice.version });
}

/** Installed, so the only question left is whether it offers what was asked for. */
async function handOverTo(args: {
  fs: FileSystem;
  home: string;
  version: string;
  kind?: EntryKind;
}): Promise<Plan> {
  const kind = args.kind ?? "run";
  const entry = await entryOf({ ...args, kind });
  if (entry !== undefined) return { kind: "run", version: args.version, entry };
  return { kind: "stop", reason: `${args.version} is installed but offers no ${kind} entry` };
}

/**
 * Nothing installed answers. Fetching what was asked for is almost always the
 * right thing, and saying so beats asking: someone who pinned a version and ran
 * a command has already said which one they want.
 *
 * The exception is a machine with nothing at all, where the first install is
 * worth naming as such rather than looking like a failure.
 */
function missing(args: { request: VersionRequest; reason: string }): Plan {
  const range = args.request.range.trim();
  if (range === "") return { kind: "stop", reason: args.reason };
  return { kind: "install", request: range, reason: args.reason };
}
