/** What decided the version, in the order the answers are looked for. */
export type VersionSource =
  /** The `venn` field of a `venn.toml`, which is a project pinning its language. */
  | "manifest"
  /** A `.venn-version` file, for a directory that is not a project. */
  | "file"
  /** The version chosen for everything that does not ask. */
  | "default"
  /** Nothing asked and nothing was chosen, so the newest installed will do. */
  | "none";

/**
 * What a directory asked for, and why.
 *
 * The range is what was written, not what it resolves to. `0.2` and `>=1 <1.5`
 * are answers to "which version does this want", and which installed version
 * that turns out to be is {@link VersionChoice}.
 *
 * The reason travels with it because someone asking is usually surprised by the
 * answer, and "0.2.0, because of the venn.toml two directories up" ends the
 * conversation that "0.2.0" starts.
 */
export interface VersionRequest {
  /** A version or a range. `*` when nothing asked, which any version answers. */
  readonly range: string;
  readonly source: VersionSource;
  /** The file that decided, absent for `default` and `none`. */
  readonly from: string | undefined;
}

/** Which installed version answers a request, and what else could have. */
export interface VersionChoice {
  /** The newest installed version satisfying the range, absent when none does. */
  readonly version: string | undefined;
  readonly request: VersionRequest;
  /** Everything installed that satisfies, newest first. */
  readonly candidates: readonly string[];
}
