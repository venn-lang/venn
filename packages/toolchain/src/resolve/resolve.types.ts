/** What decided the version, in the order the answers are looked for. */
export type VersionSource =
  /** The `venn` field of a `venn.toml`, which is a project pinning its language. */
  | "manifest"
  /** A `.venn-version` file, for a directory that is not a project. */
  | "file"
  /** The version chosen for everything that does not ask. */
  | "default"
  /** Nothing asked and nothing was chosen, so there is no answer to give. */
  | "none";

/**
 * The version a directory is asking for, and why.
 *
 * The reason travels with the answer because someone asking is usually
 * surprised by it, and "0.2.0, because of the venn.toml two directories up"
 * ends the conversation that "0.2.0" starts.
 */
export interface ResolvedVersion {
  /** Undefined only when `source` is `none`. */
  readonly version: string | undefined;
  readonly source: VersionSource;
  /** The file that decided, absent for `default` and `none`. */
  readonly from: string | undefined;
}
