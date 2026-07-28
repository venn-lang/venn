import type {
  BuildTarget,
  Dependency,
  PackageInfo,
  Profile,
  ToolingSettings,
  WorkspaceSettings,
} from "./project.types.js";

/** A parsed `venn.toml`: the project manifest the LSP and the runner read. */
export interface Manifest {
  name: string;
  version: string;
  /** `[package]` in full. `name` and `version` above are the short way in. */
  package: PackageInfo;
  /** `[lib]` and `[[bin]]`, in the order they were written. */
  targets: readonly BuildTarget[];
  dependencies: readonly Dependency[];
  devDependencies: readonly Dependency[];
  /** `[patch]`: a version this project insists on, wherever it is asked for. */
  patch: readonly Dependency[];
  /** `[profile.<name>]`, keyed by name. `dev` and `release` are built in. */
  profiles: Record<string, Profile>;
  tooling: ToolingSettings;
  /** `[workspace]`, or absent when this manifest is a plain package. */
  workspace?: WorkspaceSettings;
  /** `[env.<name>]` sections, mapping an environment to its variables. */
  env: Record<string, Record<string, string>>;
  /**
   * `[env] files`: which dotenv files to read, in order, later winning.
   * `${name}` stands for the selected environment. Empty means the convention.
   */
  envFiles: readonly string[];
  /** `[paths]`, mapping an `#alias` to a directory. */
  paths: Record<string, string>;
  /** `[format]`: how `venn fmt` and the editor format this project. */
  format: FormatSettings;
}

/** The `[format]` table. Absent keys fall back to the language defaults. */
export interface FormatSettings {
  indent?: number;
  tabs?: boolean;
  organize?: boolean;
  sort?: boolean;
}

/**
 * Produces a {@link Manifest}. Implementations: `toml-manifest` parses one,
 * `memory-manifest` returns a preset.
 */
export interface ManifestProvider {
  load(): Manifest;
}
