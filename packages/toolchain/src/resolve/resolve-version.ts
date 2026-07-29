import type { FileSystem } from "@venn-lang/contracts";
import { ancestors } from "./ancestors.js";
import { pinnedIn } from "./pinned-version.js";
import type { VersionChoice, VersionRequest } from "./resolve.types.js";

/** Nothing asked, so anything installed answers, and the newest wins. */
const ANY: VersionRequest = { range: "*", source: "none", from: undefined };

/**
 * What version of the language a directory is asking for, and why.
 *
 * Looks for a pin in that directory and then in each one above it, nearest
 * first, so a command run inside `tests/api` gets the version its project
 * declared. Falls back to the version chosen for everything that does not ask,
 * and then to `*`, which every installed version answers.
 *
 * Answers a question and nothing more: nothing is installed, nothing is
 * written, nothing is run. Which installed version the answer turns out to mean
 * is {@link selectVersion}, and what to do when none is installed belongs to
 * whoever asked.
 *
 * @param fs Where to read from.
 * @param directory The working directory, as a plain path.
 * @param defaultVersion The global default, absent when none has been chosen.
 * @returns The range asked for, what decided it, and the file that did.
 */
export async function resolveVersion(args: {
  fs: FileSystem;
  directory: string;
  defaultVersion?: string | undefined;
}): Promise<VersionRequest> {
  for (const at of ancestors(args.directory)) {
    const pinned = await pinnedIn({ fs: args.fs, directory: at });
    if (pinned) return pinned;
  }
  if (args.defaultVersion === undefined) return ANY;
  return { range: args.defaultVersion, source: "default", from: undefined };
}

/**
 * The choice in a line, for the command that has to explain it.
 *
 * @example "0.2.4, the newest matching 0.2.x, pinned by /work/api/venn.toml"
 */
export function describe(choice: VersionChoice): string {
  const { request, version } = choice;
  if (version === undefined) return nothingFor(choice);
  return `${version}, ${matching(request, version)}${because(request)}`;
}

/** Only worth saying the range when it asked for more than one version. */
function matching(request: VersionRequest, version: string): string {
  if (request.source === "none") return "the newest installed";
  return request.range === version ? "as asked" : `the newest matching ${request.range}`;
}

function because(request: VersionRequest): string {
  switch (request.source) {
    case "manifest":
    case "file":
      return `, pinned by ${request.from}`;
    case "default":
      return ", the default, since nothing here asks for one";
    default:
      return "";
  }
}

function nothingFor(choice: VersionChoice): string {
  const { request } = choice;
  if (request.source === "none") return "no version of the language is installed";
  const where = request.from === undefined ? "the default" : request.from;
  return `no installed version matches ${request.range}, asked for by ${where}`;
}
