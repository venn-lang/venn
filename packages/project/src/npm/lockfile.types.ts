/** One package that ended up installed. */
export interface LockedPackage {
  name: string;
  version: string;
  /**
   * `sha256-…` over the files this package installed.
   *
   * Not the registry's integrity hash, which lives in each manager's own lock
   * in each manager's format. This is computed from what landed on disk and
   * catches any divergence from the moment the lock was written. Absent in a
   * lock written before hashes existed. See `hashPackage`.
   */
  integrity?: string;
  /** What it says it needs, so the graph can be read without the disk. */
  dependencies?: Record<string, string>;
}

/**
 * `venn.lock`: what this project resolved to, in a form no tool owns.
 *
 * Read from what is actually installed rather than translated out of whichever
 * manager's lock produced it, because tracking three formats that change
 * without asking would mean two machines building different things the day the
 * translation drifts.
 *
 * It pins the exact version of every package and a hash of the files each one
 * installed, so `venn install --frozen` can refuse a tree that has drifted,
 * whether a registry answered differently or something was changed by hand.
 */
export interface Lockfile {
  version: 1;
  /** Which tool did the resolving. The answer can differ between them. */
  manager: string;
  /** Every package installed, in name order. */
  packages: readonly LockedPackage[];
}

/** The lock file's name, at the project root beside the manifest. */
export const LOCK_FILE = "venn.lock";

/** The format version written into every lock. */
export const LOCK_VERSION = 1;
