import { ancestorsOf } from "@venn-lang/contracts";

/**
 * A directory and every directory above it, nearest first.
 *
 * A subdirectory of a project is part of that project, so running a command
 * from `tests/api` has to find the `venn.toml` at the root. Walking stops at
 * the filesystem root rather than at the home directory: a project can sit
 * anywhere, including outside it.
 *
 * The walk itself lives in `contracts`, so the toolchain, the project reader
 * and the editor all stop in the same place.
 *
 * @param directory Where to start, as a plain path.
 * @returns Every directory from that one upwards, ending with the root.
 */
export function ancestors(directory: string): string[] {
  return ancestorsOf(directory);
}
