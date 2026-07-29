import type { FileSystem } from "@venn-lang/contracts";
import { ancestors } from "./ancestors.js";
import { pinnedIn } from "./pinned-version.js";
import type { ResolvedVersion } from "./resolve.types.js";

/** Nothing pinned and nothing chosen: the answer, and it needs saying. */
const NOTHING: ResolvedVersion = { version: undefined, source: "none", from: undefined };

/**
 * Which version of the language a directory is asking for, and why.
 *
 * Looks for a pin in that directory and then in each one above it, nearest
 * first, so a command run inside `tests/api` gets the version its project
 * declared. Falls back to the version chosen for everything that does not ask.
 *
 * Answers a question and nothing more: nothing is installed, nothing is
 * written, nothing is run. What to do about a version that is not on the
 * machine is the caller's to decide, and this is what tells it which one.
 *
 * @param fs Where to read from.
 * @param directory The working directory, as a plain path.
 * @param defaultVersion The global default, absent when none has been chosen.
 * @returns The version, what decided it, and the file that did.
 */
export async function resolveVersion(args: {
  fs: FileSystem;
  directory: string;
  defaultVersion?: string | undefined;
}): Promise<ResolvedVersion> {
  for (const at of ancestors(args.directory)) {
    const pinned = await pinnedIn({ fs: args.fs, directory: at });
    if (pinned) return pinned;
  }
  if (args.defaultVersion === undefined) return NOTHING;
  return { version: args.defaultVersion, source: "default", from: undefined };
}

/**
 * The resolution in a line, for the command that has to explain it.
 *
 * @example "0.2.0, pinned by /work/api/venn.toml"
 */
export function describe(resolved: ResolvedVersion): string {
  switch (resolved.source) {
    case "manifest":
      return `${resolved.version}, pinned by ${resolved.from}`;
    case "file":
      return `${resolved.version}, pinned by ${resolved.from}`;
    case "default":
      return `${resolved.version}, the default, since nothing here asks for one`;
    default:
      return "no version chosen, and nothing here asks for one";
  }
}
