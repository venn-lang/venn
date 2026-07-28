/**
 * What a manifest declares about the project itself, as against how it runs.
 *
 * The shape follows Cargo's, because the questions are the same and an answer
 * the reader already knows beats a better one they must learn. Where Cargo has
 * something this does not, the gap is noted so it reads as a decision.
 */

/** `[package]`: who this is. */
export interface PackageInfo {
  name: string;
  /**
   * What `[package] version` said, and nothing when it said nothing.
   *
   * Optional so "not written" stays distinguishable from "written as 0.0.0": a
   * workspace member inherits the first and keeps the second. `Manifest.version`
   * is the resolved value, with the default already applied.
   */
  version?: string;
  description?: string;
  license?: string;
  authors: readonly string[];
  /** `[package] edition`: which language revision this was written against. */
  edition?: string;
}

/** What a project builds. A server is a `bin` that does not end. */
export type TargetKind = "lib" | "bin" | "test";

/** `[lib]` or one entry of `[[bin]]`: a thing to build, and where it starts. */
export interface BuildTarget {
  kind: TargetKind;
  /** The name it is known by; a `bin`'s name is what `venn run --bin` takes. */
  name: string;
  /** The `.vn` file this target starts from, relative to the manifest. */
  path: string;
}

/** One entry of `[dependencies]` / `[dev-dependencies]`. */
export interface Dependency {
  name: string;
  /** A semver range, or absent when the version comes from elsewhere. */
  version?: string;
  /** `{ path = "../other" }`: a sibling in this workspace or on disk. */
  path?: string;
  /** `{ workspace = true }`: take the version the workspace pinned. */
  fromWorkspace: boolean;
  /** `{ optional = true }`: resolved and locked, installed only on demand. */
  optional: boolean;
}

/**
 * `[profile.dev]` and `[profile.release]`: how a build is made.
 *
 * One key, because one key is what a build does today. Settings about generated
 * code, such as `sourceMap` and `minify`, arrive with the compiler: declaring
 * them now would read as a contract and honour nothing.
 */
export interface Profile {
  /** Whether a problem stops the build instead of only being reported. */
  strict?: boolean;
}

/**
 * Which package manager runs underneath `venn add` and `venn remove`.
 *
 * The interface is ours, the resolution is not: resolving versions well is
 * years of work against three moving targets.
 */
export type PackageManagerName = "pnpm" | "npm" | "bun" | "yarn";

/** The `[tooling]` table. */
export interface ToolingSettings {
  manager: PackageManagerName;
}

/**
 * `[workspace]`: a root that owns members, one lockfile and one `target/`.
 *
 * `[features]` is deliberately absent. It is the most intricate part of Cargo,
 * it rests on conditional compilation this language does not have, and half of
 * it would be worse than none.
 */
export interface WorkspaceSettings {
  /** Path globs naming the members, e.g. `["packages/*"]`. */
  members: readonly string[];
  exclude: readonly string[];
  /** Which members a command with no target acts on. Empty means all of them. */
  defaultMembers: readonly string[];
  /** `[workspace.package]`: metadata a member may inherit. */
  package: Partial<PackageInfo>;
  /** `[workspace.dependencies]`: the versions `{ workspace = true }` takes. */
  dependencies: readonly Dependency[];
}
