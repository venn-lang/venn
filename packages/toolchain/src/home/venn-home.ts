import type { FileSystem } from "@venn-lang/contracts";
import { entryOf } from "./entry-of.js";

/**
 * Where the versions live.
 *
 * `VENN_HOME` first, so a machine that keeps tools somewhere else, or a test
 * that wants a directory of its own, does not have to move a home directory to
 * say so.
 *
 * @param env The environment, passed in rather than read, since this package
 * cannot reach `process`.
 * @param home The home directory, used when `VENN_HOME` says nothing.
 */
export function vennHome(args: {
  env: Readonly<Record<string, string | undefined>>;
  home: string;
}): string {
  const named = args.env.VENN_HOME?.trim();
  return named !== undefined && named !== "" ? named : `${args.home}/.venn`;
}

/** Where a version's files are, given the home directory. */
export function versionRoot(args: { home: string; version: string }): string {
  return `${args.home}/versions/${args.version}`;
}

/**
 * Which versions are installed.
 *
 * Read from the directory rather than from a file listing them: a file can
 * disagree with the disk, and then two things have to be repaired instead of
 * one. A directory whose entry point is missing is not counted, since a version
 * that cannot be run is not installed however complete it looks.
 *
 * @returns Every usable version, in no promised order.
 */
export async function installedVersions(args: { fs: FileSystem; home: string }): Promise<string[]> {
  const entries = await args.fs.list(`${args.home}/versions`).catch(() => []);
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.directory || entry.name.startsWith(".")) continue;
    const runnable = await entryOf({ ...args, version: entry.name, kind: "run" });
    if (runnable !== undefined && (await args.fs.exists(runnable))) found.push(entry.name);
  }
  return found;
}

/**
 * The version chosen for everything that does not ask, if one has been.
 *
 * @returns The version named in `default`, or nothing when the file is absent
 * or names a version that is no longer installed.
 */
export async function defaultVersion(args: {
  fs: FileSystem;
  home: string;
}): Promise<string | undefined> {
  const path = `${args.home}/default`;
  if (!(await args.fs.exists(path))) return undefined;
  const named = new TextDecoder().decode(await args.fs.read(path)).trim();
  if (named === "") return undefined;
  const installed = await installedVersions(args);
  return installed.includes(named) ? named : undefined;
}
