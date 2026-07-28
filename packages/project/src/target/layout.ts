import { join } from "../paths/index.js";

/**
 * Where everything a build produces or fetches goes.
 *
 * One directory at the workspace root holds every derived thing, the way
 * Cargo's `target/` does, so deleting it costs time and nothing else.
 *
 * The dependencies live inside it, and that placement is load-bearing rather
 * than tidiness: Node resolves a package by walking up from the importing file
 * looking for `node_modules`, and built output sits in `target/debug` or
 * `target/release`, one level below `target/node_modules`. The ordinary
 * resolver finds them with no loader and no symlink. Moving the output out of
 * `target/` breaks that quietly.
 */
export const TARGET_DIR = "target";

/** The names inside `target/`. */
export const TARGET_LAYOUT = {
  /** What the package manager installs, and what Node's resolver will find. */
  modules: "node_modules",
  /** Compiled addons, kept apart because they are per-platform, not per-project. */
  native: "native_modules",
  /** Built output, one directory per profile. */
  debug: "debug",
  release: "release",
} as const;

/** Which build profile an output directory belongs to. */
export type ProfileName = "debug" | "release";

/** The `target/` of a project, given its root. */
export function targetDir(root: string): string {
  return join(root, TARGET_DIR);
}

/** Where the package manager installs, and where Node's resolver will look. */
export function modulesDir(root: string): string {
  return join(targetDir(root), TARGET_LAYOUT.modules);
}

/** Where compiled addons go, kept apart because they are per-platform. */
export function nativeModulesDir(root: string): string {
  return join(targetDir(root), TARGET_LAYOUT.native);
}

/** Where a build of this profile is written. */
export function outputDir(args: { root: string; profile: ProfileName }): string {
  return join(targetDir(args.root), TARGET_LAYOUT[args.profile]);
}
