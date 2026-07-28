import type { BuildTarget, Manifest } from "@venn/contracts";

/**
 * A package on disk: one `venn.toml`, and what it turned out to describe.
 *
 * `targets` is what the manifest declared plus what the conventions filled in.
 * The difference between the two matters to whoever writes a manifest and to
 * nobody downstream, so it is settled here rather than carried further.
 */
export interface Package {
  /** The directory holding the `venn.toml`, with no trailing separator. */
  dir: string;
  manifest: Manifest;
  targets: readonly BuildTarget[];
}

/**
 * What a command is acting on: one root, and every package under it.
 *
 * A lone package is a workspace of one, so nothing downstream has to ask which
 * it is. `isWorkspace` is for the two places that genuinely differ: where
 * `target/` goes, and what a bare command means.
 */
export interface Project {
  /** The workspace root, or the package's own directory when there is none. */
  root: string;
  isWorkspace: boolean;
  /**
   * The manifest at the root, carried whether or not the root is a package.
   *
   * A workspace root often declares no `[package]` at all and still carries the
   * `[env]` tables and path aliases everything under it uses, so it cannot be
   * inferred from the member list.
   */
  rootManifest: Manifest;
  /** Every member, in the order the globs found them. A lone package is one. */
  packages: readonly Package[];
  /** What a command with no target acts on: `default-members`, or all of them. */
  defaultPackages: readonly Package[];
}

/** Reading a project failed, and why. Never a raw error from the disk. */
export interface ProjectProblem {
  code: string;
  title: string;
  /** The path the problem is about, when there is one. */
  path?: string;
}

/** The result of a lookup: the project, or why there is none. */
export interface FoundProject {
  /** Absent when no manifest was found, in which case `problems` says so. */
  project?: Project;
  problems: readonly ProjectProblem[];
}
