import type { FileSystem } from "@venn-lang/contracts";
import type { Lockfile } from "./lockfile.types.js";
import { readInstalled } from "./read-installed.js";

/** How one package differs from what the lock recorded. */
export interface Drift {
  name: string;
  /**
   * In the lock but absent, installed but not locked, a different version, or
   * the same version with different files.
   */
  kind: "missing" | "unexpected" | "version" | "contents";
  /** What the lock recorded: a version, or an `integrity` hash. */
  expected?: string;
  /** What is on disk, when the two can be compared side by side. */
  found?: string;
}

/**
 * Checks what is installed against what the lock says should be.
 *
 * This is what the hashes are for. Checked, they turn a registry that answered
 * differently today, or a file edited by hand inside `node_modules`, into
 * something a build refuses to start with rather than something found in
 * production.
 *
 * @returns One `Drift` per difference, empty when the tree matches. A lock
 * entry carrying no `integrity` is not checked for contents, so a lock written
 * before hashes existed still passes.
 */
export async function verifyLock(args: {
  fs: FileSystem;
  root: string;
  lock: Lockfile;
}): Promise<Drift[]> {
  const installed = await readInstalled({ fs: args.fs, root: args.root });
  const byName = new Map(installed.map((one) => [one.name, one]));
  const drift = args.lock.packages.flatMap((locked) => compare(locked, byName.get(locked.name)));
  const expected = new Set(args.lock.packages.map((one) => one.name));
  const extra = installed.filter((one) => !expected.has(one.name));
  return [...drift, ...extra.map((one) => ({ name: one.name, kind: "unexpected" as const }))];
}

type Locked = Lockfile["packages"][number];

function compare(locked: Locked, found: Locked | undefined): Drift[] {
  if (!found) return [{ name: locked.name, kind: "missing", expected: locked.version }];
  if (found.version !== locked.version) {
    return [{ name: locked.name, kind: "version", expected: locked.version, found: found.version }];
  }
  // Only when the lock carried one. A lock written before hashes existed is
  // still a lock, and refusing it would break a project for being older.
  if (locked.integrity && found.integrity !== locked.integrity) {
    return [{ name: locked.name, kind: "contents", expected: locked.integrity }];
  }
  return [];
}

/**
 * Renders drift for a person to read.
 *
 * @returns One indented line per package that differs, in the voice of what
 * went wrong. Empty for an empty list.
 */
export function describeDrift(drift: readonly Drift[]): string {
  return drift.map(lineFor).join("\n");
}

const LINES: Record<Drift["kind"], (drift: Drift) => string> = {
  missing: (one) => `  ${one.name}@${one.expected} is in the lock but not installed`,
  unexpected: (one) => `  ${one.name} is installed but not in the lock`,
  version: (one) => `  ${one.name}: lock says ${one.expected}, installed is ${one.found}`,
  contents: (one) => `  ${one.name}: installed files differ from what was locked`,
};

function lineFor(one: Drift): string {
  return LINES[one.kind](one);
}
