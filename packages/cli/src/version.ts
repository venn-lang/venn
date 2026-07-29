import { createRequire } from "node:module";

/** The manifest to accept, so a neighbour's is never read by mistake. */
const NAME = "@venn-lang/cli";

/** Where the manifest sits relative to this file, in a release and in the tree. */
const CANDIDATES = ["../package.json", "../../package.json", "../../../package.json"];

/**
 * The version of the CLI that is running.
 *
 * Read from the package manifest rather than written into the source, so a
 * release cannot ship a binary that reports the version before it.
 *
 * The path is searched rather than assumed. The bundle flattens
 * `src/version.ts` into `dist/cli.mjs`, so the manifest is two levels up
 * while developing and one in a release; assuming either one reports `0.0.0` to
 * everybody living with the other, and the name check keeps the search from
 * settling on some other package's manifest on the way up.
 */
export const VERSION: string = read();

function read(): string {
  const require = createRequire(import.meta.url);
  for (const path of CANDIDATES) {
    const version = versionAt(require, path);
    if (version) return version;
  }
  return "0.0.0";
}

function versionAt(require: ReturnType<typeof createRequire>, path: string): string | undefined {
  try {
    const manifest = require(path) as { name?: string; version?: string };
    return manifest.name === NAME ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}
