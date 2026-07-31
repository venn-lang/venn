import { createPaths } from "./create-paths.js";
import type { Paths, PathsArgs } from "./paths.types.js";
import type { Spelling } from "./spelling.types.js";

/** A share on another machine, which is a root like any drive is. */
const SHARE = /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+[\\/]?/;
/** A drive, with or without the separator that makes it absolute. */
const DRIVE = /^[A-Za-z]:[\\/]?/;
/** No drive said, so whichever one the program is standing on. */
const CURRENT = /^[\\/]/;

const WINDOWS: Spelling = {
  separator: "\\",
  splitter: /[/\\]/,
  cwd: "C:\\",
  rootOf: (path) => headOf(path),
  write: (root) => writtenRoot(root),
  // Two names that differ by case are one file here, so `relative` has to agree
  // or it answers with a walk up and back down to the place it started.
  same: (left, right) => left.toLowerCase() === right.toLowerCase(),
};

/**
 * Paths the way Windows writes them: a drive or a share to start from, either
 * separator accepted, and names compared without case.
 *
 * `C:` without a separator is not absolute. It means wherever that drive is
 * standing, which is a place the program has to be told, so `..` from it is
 * kept rather than dropped.
 *
 * @param args Where relative paths start from. `C:\` by default.
 * @returns The {@link Paths} implementation.
 */
export function createWindowsPaths(args: PathsArgs = {}): Paths {
  return createPaths(WINDOWS, args);
}

/**
 * A root the way this host writes it, ending in a separator unless it is a bare
 * drive, which names no place until the program is told which one.
 */
function writtenRoot(root: string): string {
  if (root === "") return "";
  const shown = root.replace(/[/]/g, WINDOWS.separator);
  const ends = shown.endsWith(":") || shown.endsWith(WINDOWS.separator);
  return ends ? shown : shown + WINDOWS.separator;
}

function headOf(path: string): string {
  return (SHARE.exec(path) ?? DRIVE.exec(path) ?? CURRENT.exec(path))?.[0] ?? "";
}
