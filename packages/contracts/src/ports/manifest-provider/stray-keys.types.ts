/** A table or key in a `venn.toml` that nothing reads, and where it is written. */
export interface StrayKey {
  /** The path, as written: `runner`, or `format.indeent`. */
  readonly path: string;
  /** The 1-based line it is written on. */
  readonly line: number;
}
