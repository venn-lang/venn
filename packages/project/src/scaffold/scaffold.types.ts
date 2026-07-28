/** What kind of thing is being started. */
export type ScaffoldKind = "lib" | "bin" | "workspace";

/** What to start, and what the surroundings already provide. */
export interface ScaffoldRequest {
  kind: ScaffoldKind;
  /** The package name, which is also the directory when one is created. */
  name: string;
  /**
   * Whether a workspace above will claim this package as a member.
   *
   * Changes what is written rather than only where: a member leaves out what it
   * would inherit and carries no ignore file, because the root already owns the
   * one `target/` there is.
   */
  insideWorkspace?: boolean;
}

/** One file to write, its path relative to the directory being started. */
export interface ScaffoldFile {
  path: string;
  content: string;
}
