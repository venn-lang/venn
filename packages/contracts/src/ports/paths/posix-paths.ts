import { createPaths } from "./create-paths.js";
import type { Paths, PathsArgs } from "./paths.types.js";
import type { Spelling } from "./spelling.types.js";

const POSIX: Spelling = {
  separator: "/",
  splitter: /[/]/,
  cwd: "/",
  rootOf: (path) => (path.startsWith("/") ? "/" : ""),
  write: (root) => root,
  same: (left, right) => left === right,
};

/**
 * Paths the way everything but Windows writes them: one root, one separator,
 * and two names that differ by case are two names.
 *
 * @param args Where relative paths start from. The root by default, which is
 * what a host with no directory of its own, an editor's worker, has.
 * @returns The {@link Paths} implementation.
 */
export function createPosixPaths(args: PathsArgs = {}): Paths {
  return createPaths(POSIX, args);
}
